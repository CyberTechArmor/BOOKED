import { PrismaClient } from '@prisma/client';
import { OrgRole, UserStatus } from '../src/types/prisma.js';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Starting database seed...');

  // Get admin credentials from environment or use defaults for development
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@booked.local';
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme123!';
  const adminName = process.env.ADMIN_NAME || 'System Administrator';

  // Hash the admin password
  const passwordHash = await hash(adminPassword, {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // Create default organization
  const defaultOrg = await prisma.organization.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'Default Organization',
      slug: 'default',
      defaultTimezone: 'UTC',
      settings: {
        allowPublicBooking: true,
        requireEmailVerification: false,
        defaultEventDuration: 30,
        workWeekStart: 1, // Monday
      },
    },
  });

  console.log(`Created/updated organization: ${defaultOrg.name} (${defaultOrg.id})`);

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      name: adminName,
    },
    create: {
      email: adminEmail,
      passwordHash,
      name: adminName,
      timezone: 'UTC',
      emailVerified: true,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`Created/updated admin user: ${adminUser.email} (${adminUser.id})`);

  // Link admin user to default organization as owner
  await prisma.organizationUser.upsert({
    where: {
      organizationId_userId: {
        organizationId: defaultOrg.id,
        userId: adminUser.id,
      },
    },
    update: {
      role: OrgRole.OWNER,
    },
    create: {
      organizationId: defaultOrg.id,
      userId: adminUser.id,
      role: OrgRole.OWNER,
      permissions: ['*'], // Full permissions
    },
  });

  console.log(`Linked admin user to organization as OWNER`);

  // Create default schedule for admin
  const defaultSchedule = await prisma.userSchedule.upsert({
    where: {
      id: `${adminUser.id}-default-schedule`,
    },
    update: {},
    create: {
      id: `${adminUser.id}-default-schedule`,
      userId: adminUser.id,
      name: 'Working Hours',
      isDefault: true,
      bufferBefore: 5,
      bufferAfter: 5,
      minimumNotice: 24, // 24 hours
    },
  });

  // Create schedule windows (Mon-Fri 9AM-5PM)
  const weekdays = [1, 2, 3, 4, 5]; // Monday to Friday
  for (const dayOfWeek of weekdays) {
    await prisma.scheduleWindow.upsert({
      where: {
        id: `${defaultSchedule.id}-day-${dayOfWeek}`,
      },
      update: {},
      create: {
        id: `${defaultSchedule.id}-day-${dayOfWeek}`,
        scheduleId: defaultSchedule.id,
        dayOfWeek,
        startTime: '09:00',
        endTime: '17:00',
        isAvailable: true,
      },
    });
  }

  console.log(`Created default schedule with working hours`);

  // Create a sample event type
  const sampleEventType = await prisma.eventType.upsert({
    where: {
      organizationId_slug: {
        organizationId: defaultOrg.id,
        slug: '30-minute-meeting',
      },
    },
    update: {},
    create: {
      organizationId: defaultOrg.id,
      ownerId: adminUser.id,
      title: '30 Minute Meeting',
      slug: '30-minute-meeting',
      description: 'A quick 30-minute meeting to discuss your needs.',
      durationMinutes: 30,
      isActive: true,
      isPublic: true,
      requiresConfirmation: false,
      assignmentType: 'SINGLE',
      locationType: 'MEET',
      color: '#0066FF',
      customFields: [
        {
          name: 'phone',
          label: 'Phone Number',
          type: 'text',
          required: false,
          placeholder: '+1 (555) 123-4567',
        },
        {
          name: 'notes',
          label: 'Additional Notes',
          type: 'textarea',
          required: false,
          placeholder: 'Any specific topics you want to discuss?',
        },
      ],
      bufferBefore: 5,
      bufferAfter: 5,
      minimumNotice: 60, // 1 hour
    },
  });

  console.log(`Created sample event type: ${sampleEventType.title}`);

  // Add admin as host for the event type
  await prisma.eventTypeHost.upsert({
    where: {
      eventTypeId_userId: {
        eventTypeId: sampleEventType.id,
        userId: adminUser.id,
      },
    },
    update: {},
    create: {
      eventTypeId: sampleEventType.id,
      userId: adminUser.id,
      priority: 1,
      isActive: true,
    },
  });

  // Link event type to schedule
  await prisma.eventTypeSchedule.upsert({
    where: {
      eventTypeId_scheduleId: {
        eventTypeId: sampleEventType.id,
        scheduleId: defaultSchedule.id,
      },
    },
    update: {},
    create: {
      eventTypeId: sampleEventType.id,
      scheduleId: defaultSchedule.id,
    },
  });

  // Create default notification templates
  const notificationTemplates = [
    {
      type: 'BOOKING_CREATED' as const,
      channel: 'EMAIL' as const,
      subject: 'New Booking: {{eventType}} with {{hostName}}',
      body: `Hi {{attendeeName}},

Your booking has been confirmed!

**Details:**
- **Event:** {{eventType}}
- **Date:** {{date}}
- **Time:** {{startTime}} - {{endTime}} ({{timezone}})
- **Host:** {{hostName}}
{{#if location}}
- **Location:** {{location}}
{{/if}}
{{#if meetingUrl}}
- **Meeting Link:** {{meetingUrl}}
{{/if}}

To reschedule or cancel, click here: {{manageUrl}}

See you soon!
The {{organizationName}} Team`,
    },
    {
      type: 'BOOKING_CANCELLED' as const,
      channel: 'EMAIL' as const,
      subject: 'Booking Cancelled: {{eventType}}',
      body: `Hi {{attendeeName}},

Your booking has been cancelled.

**Cancelled Event:**
- **Event:** {{eventType}}
- **Date:** {{date}}
- **Time:** {{startTime}} - {{endTime}} ({{timezone}})

{{#if cancelReason}}
**Reason:** {{cancelReason}}
{{/if}}

To book a new appointment, visit: {{bookingUrl}}

Best regards,
The {{organizationName}} Team`,
    },
    {
      type: 'BOOKING_REMINDER' as const,
      channel: 'EMAIL' as const,
      subject: 'Reminder: {{eventType}} in {{timeUntil}}',
      body: `Hi {{attendeeName}},

This is a friendly reminder about your upcoming meeting.

**Details:**
- **Event:** {{eventType}}
- **Date:** {{date}}
- **Time:** {{startTime}} - {{endTime}} ({{timezone}})
- **Host:** {{hostName}}
{{#if meetingUrl}}
- **Meeting Link:** {{meetingUrl}}
{{/if}}

See you soon!
The {{organizationName}} Team`,
    },
  ];

  for (const template of notificationTemplates) {
    await prisma.notificationTemplate.upsert({
      where: {
        organizationId_type_channel: {
          organizationId: defaultOrg.id,
          type: template.type,
          channel: template.channel,
        },
      },
      update: {
        subject: template.subject,
        body: template.body,
      },
      create: {
        organizationId: defaultOrg.id,
        type: template.type,
        channel: template.channel,
        subject: template.subject,
        body: template.body,
        isActive: true,
      },
    });
  }

  console.log(`Created ${notificationTemplates.length} notification templates`);

  console.log('\n========================================');
  console.log('Database seed completed successfully!');
  console.log('========================================');
  console.log(`\nAdmin credentials:`);
  console.log(`  Email:    ${adminEmail}`);
  console.log(`  Password: ${adminPassword}`);
  console.log(`\nOrganization: ${defaultOrg.name}`);
  console.log(`Public booking page: /book/${defaultOrg.slug}/${sampleEventType.slug}`);
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
