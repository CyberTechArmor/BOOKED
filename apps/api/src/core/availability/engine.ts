import {
  addMinutes,
  addHours,
  addDays,
  startOfDay,
  endOfDay,
  isBefore,
  isAfter,
  differenceInMinutes,
  getDay,
  format,
  parseISO,
} from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime, formatInTimeZone } from 'date-fns-tz';
import { getPrismaClient } from '../../infrastructure/database/client.js';

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface TimeSlot extends TimeRange {
  hostIds: string[];
}

export interface AvailabilityQuery {
  eventTypeId?: string;
  userIds: string[];
  startDate: Date;
  endDate: Date;
  durationMinutes: number;
  timezone: string;
}

export interface Constraints {
  bufferBefore: number;
  bufferAfter: number;
  minimumNotice: number; // hours
  maxBookingsPerDay: number | null;
  maxBookingsPerWeek: number | null;
}

interface ScheduleWindowData {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  specificDate: Date | null;
  isAvailable: boolean;
}

/**
 * Parse a schedule window time (HH:mm) into a Date object for a specific date
 */
function parseScheduleTime(
  date: Date,
  timeStr: string,
  userTimezone: string
): Date {
  const dateStr = formatInTimeZone(date, userTimezone, 'yyyy-MM-dd');
  const localDateTime = `${dateStr}T${timeStr}:00`;
  return zonedTimeToUtc(localDateTime, userTimezone);
}

/**
 * Get base availability windows for a user
 */
async function getUserAvailabilityWindows(
  userId: string,
  startDate: Date,
  endDate: Date,
  timezone: string
): Promise<TimeRange[]> {
  const db = getPrismaClient();

  // Get user's default schedule or any schedule
  const schedule = await db.userSchedule.findFirst({
    where: { userId, isDefault: true },
    include: { windows: true },
  });

  if (!schedule) {
    const anySchedule = await db.userSchedule.findFirst({
      where: { userId },
      include: { windows: true },
    });
    if (!anySchedule) {
      return [];
    }
    return processScheduleWindows(anySchedule.windows, startDate, endDate, timezone);
  }

  return processScheduleWindows(schedule.windows, startDate, endDate, timezone);
}

/**
 * Process schedule windows into time ranges for the date range
 */
function processScheduleWindows(
  windows: ScheduleWindowData[],
  startDate: Date,
  endDate: Date,
  timezone: string
): TimeRange[] {
  const ranges: TimeRange[] = [];
  let currentDate = startOfDay(startDate);

  while (isBefore(currentDate, endDate)) {
    const dayOfWeek = getDay(currentDate);

    // Check for date-specific overrides first
    const dateOverride = windows.find(
      (w) =>
        w.specificDate &&
        format(w.specificDate, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd')
    );

    if (dateOverride) {
      if (dateOverride.isAvailable) {
        ranges.push({
          start: parseScheduleTime(currentDate, dateOverride.startTime, timezone),
          end: parseScheduleTime(currentDate, dateOverride.endTime, timezone),
        });
      }
      // If not available, skip this day
    } else {
      // Get regular windows for this day
      const dayWindows = windows.filter(
        (w) => w.dayOfWeek === dayOfWeek && w.specificDate === null && w.isAvailable
      );

      for (const window of dayWindows) {
        ranges.push({
          start: parseScheduleTime(currentDate, window.startTime, timezone),
          end: parseScheduleTime(currentDate, window.endTime, timezone),
        });
      }
    }

    currentDate = addDays(currentDate, 1);
  }

  return ranges;
}

/**
 * Get busy times for a user (bookings + external calendar blocks)
 */
async function getBusyTimes(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<TimeRange[]> {
  const db = getPrismaClient();

  // Get existing bookings
  const bookings = await db.booking.findMany({
    where: {
      hostId: userId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      startTime: { lt: endDate },
      endTime: { gt: startDate },
    },
    select: { startTime: true, endTime: true },
  });

  // Get busy blocks from external calendars
  const busyBlocks = await db.busyBlock.findMany({
    where: {
      userId,
      startTime: { lt: endDate },
      endTime: { gt: startDate },
    },
    select: { startTime: true, endTime: true },
  });

  return [
    ...bookings.map((b) => ({ start: b.startTime, end: b.endTime })),
    ...busyBlocks.map((b) => ({ start: b.startTime, end: b.endTime })),
  ];
}

/**
 * Subtract busy times from available ranges
 */
function subtractBusyTimes(
  available: TimeRange[],
  busy: TimeRange[]
): TimeRange[] {
  let result = [...available];

  for (const busyRange of busy) {
    const newResult: TimeRange[] = [];

    for (const availRange of result) {
      // No overlap - keep the available range
      if (
        isAfter(busyRange.start, availRange.end) ||
        isBefore(busyRange.end, availRange.start)
      ) {
        newResult.push(availRange);
        continue;
      }

      // Busy starts after available starts - keep the part before busy
      if (isAfter(busyRange.start, availRange.start)) {
        newResult.push({
          start: availRange.start,
          end: busyRange.start,
        });
      }

      // Busy ends before available ends - keep the part after busy
      if (isBefore(busyRange.end, availRange.end)) {
        newResult.push({
          start: busyRange.end,
          end: availRange.end,
        });
      }
    }

    result = newResult;
  }

  return result;
}

/**
 * Apply constraints to available ranges
 */
async function applyConstraints(
  ranges: TimeRange[],
  userId: string,
  constraints: Constraints
): Promise<TimeRange[]> {
  let result = ranges;

  // Apply minimum notice
  if (constraints.minimumNotice > 0) {
    const minStart = addHours(new Date(), constraints.minimumNotice);
    result = result
      .filter((r) => isAfter(r.end, minStart))
      .map((r) => ({
        start: isBefore(r.start, minStart) ? minStart : r.start,
        end: r.end,
      }));
  }

  // Apply buffers (shrink available windows)
  if (constraints.bufferBefore > 0 || constraints.bufferAfter > 0) {
    result = result
      .map((r) => ({
        start: addMinutes(r.start, constraints.bufferBefore),
        end: addMinutes(r.end, -constraints.bufferAfter),
      }))
      .filter((r) => isBefore(r.start, r.end));
  }

  // Apply daily/weekly caps
  if (constraints.maxBookingsPerDay || constraints.maxBookingsPerWeek) {
    result = await applyBookingCaps(result, userId, constraints);
  }

  return result;
}

/**
 * Apply booking caps (daily/weekly limits)
 */
async function applyBookingCaps(
  ranges: TimeRange[],
  userId: string,
  constraints: Constraints
): Promise<TimeRange[]> {
  const db = getPrismaClient();

  // Group ranges by day
  const rangesByDay = new Map<string, TimeRange[]>();
  for (const range of ranges) {
    const dayKey = format(range.start, 'yyyy-MM-dd');
    if (!rangesByDay.has(dayKey)) {
      rangesByDay.set(dayKey, []);
    }
    rangesByDay.get(dayKey)!.push(range);
  }

  const result: TimeRange[] = [];

  for (const [dayKey, dayRanges] of rangesByDay) {
    const dayStart = startOfDay(parseISO(dayKey));
    const dayEnd = endOfDay(dayStart);

    // Count bookings for this day
    if (constraints.maxBookingsPerDay) {
      const dayBookingCount = await db.booking.count({
        where: {
          hostId: userId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          startTime: { gte: dayStart, lt: dayEnd },
        },
      });

      if (dayBookingCount >= constraints.maxBookingsPerDay) {
        continue; // Skip all ranges for this day
      }
    }

    result.push(...dayRanges);
  }

  return result;
}

/**
 * Slice available ranges into bookable slots of the specified duration
 */
function sliceIntoSlots(ranges: TimeRange[], durationMinutes: number): TimeRange[] {
  const slots: TimeRange[] = [];

  for (const range of ranges) {
    let slotStart = range.start;

    while (differenceInMinutes(range.end, slotStart) >= durationMinutes) {
      slots.push({
        start: slotStart,
        end: addMinutes(slotStart, durationMinutes),
      });
      slotStart = addMinutes(slotStart, 15); // 15-minute increments
    }
  }

  return slots;
}

/**
 * Find collective availability (slots where ALL users are available)
 */
function findCollectiveSlots(
  allSlots: TimeRange[][],
  userIds: string[]
): TimeSlot[] {
  if (allSlots.length === 0) return [];
  if (allSlots.length === 1) {
    return allSlots[0]!.map((s) => ({ ...s, hostIds: userIds }));
  }

  const result: TimeSlot[] = [];
  const firstUserSlots = allSlots[0]!;

  for (const slot of firstUserSlots) {
    const slotTime = slot.start.getTime();

    // Check if this time exists for all other users
    const allHaveSlot = allSlots.every((userSlots) =>
      userSlots.some((s) => s.start.getTime() === slotTime)
    );

    if (allHaveSlot) {
      result.push({
        start: slot.start,
        end: slot.end,
        hostIds: userIds,
      });
    }
  }

  return result;
}

/**
 * Assign hosts using round-robin algorithm
 */
async function assignRoundRobin(
  allSlots: TimeRange[][],
  userIds: string[],
  eventTypeId: string
): Promise<TimeSlot[]> {
  const db = getPrismaClient();

  // Get current booking counts for fairness
  const hosts = await db.eventTypeHost.findMany({
    where: { eventTypeId, isActive: true },
    orderBy: [
      { bookingCount: 'asc' },
      { lastBookedAt: 'asc' },
      { priority: 'desc' },
    ],
  });

  // Create a map of slot time -> available hosts
  const slotHostMap = new Map<string, string[]>();

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i]!;
    const userSlots = allSlots[i];
    if (!userSlots) continue;

    for (const slot of userSlots) {
      const key = slot.start.toISOString();
      if (!slotHostMap.has(key)) {
        slotHostMap.set(key, []);
      }
      slotHostMap.get(key)!.push(userId);
    }
  }

  // Assign hosts in round-robin order
  const result: TimeSlot[] = [];
  let hostIndex = 0;

  const sortedSlotTimes = Array.from(slotHostMap.keys()).sort();

  for (const timeKey of sortedSlotTimes) {
    const availableHosts = slotHostMap.get(timeKey)!;

    // Find next available host in rotation
    for (let i = 0; i < hosts.length; i++) {
      const nextHost = hosts[(hostIndex + i) % hosts.length];
      if (nextHost && availableHosts.includes(nextHost.userId)) {
        result.push({
          start: new Date(timeKey),
          end: addMinutes(new Date(timeKey), 30), // Will be updated with correct duration
          hostIds: [nextHost.userId],
        });
        hostIndex = (hostIndex + i + 1) % hosts.length;
        break;
      }
    }
  }

  return result;
}

/**
 * Merge constraints from user schedule and event type
 */
async function getConstraints(
  userId: string,
  eventTypeId?: string
): Promise<Constraints> {
  const db = getPrismaClient();

  // Get user's default schedule constraints
  const schedule = await db.userSchedule.findFirst({
    where: { userId, isDefault: true },
  });

  let constraints: Constraints = {
    bufferBefore: schedule?.bufferBefore ?? 0,
    bufferAfter: schedule?.bufferAfter ?? 0,
    minimumNotice: schedule?.minimumNotice ?? 0,
    maxBookingsPerDay: schedule?.maxBookingsPerDay ?? null,
    maxBookingsPerWeek: schedule?.maxBookingsPerWeek ?? null,
  };

  // Override with event type constraints if present
  if (eventTypeId) {
    const eventType = await db.eventType.findUnique({
      where: { id: eventTypeId },
    });

    if (eventType) {
      constraints = {
        bufferBefore: eventType.bufferBefore ?? constraints.bufferBefore,
        bufferAfter: eventType.bufferAfter ?? constraints.bufferAfter,
        minimumNotice: eventType.minimumNotice ?? constraints.minimumNotice,
        maxBookingsPerDay: eventType.maxBookingsPerDay ?? constraints.maxBookingsPerDay,
        maxBookingsPerWeek: constraints.maxBookingsPerWeek,
      };
    }
  }

  return constraints;
}

/**
 * Main availability calculation function
 */
export async function getAvailability(query: AvailabilityQuery): Promise<TimeSlot[]> {
  const { userIds, startDate, endDate, durationMinutes, timezone, eventTypeId } = query;

  const db = getPrismaClient();

  // 1. Get base availability for each user
  const userAvailability = await Promise.all(
    userIds.map((userId) =>
      getUserAvailabilityWindows(userId, startDate, endDate, timezone)
    )
  );

  // 2. Get busy times (existing bookings + external calendars)
  const busyTimes = await Promise.all(
    userIds.map((userId) => getBusyTimes(userId, startDate, endDate))
  );

  // 3. Calculate free slots per user
  const freeSlots = userIds.map((_, i) =>
    subtractBusyTimes(userAvailability[i]!, busyTimes[i]!)
  );

  // 4. Apply constraints
  const constrainedSlots = await Promise.all(
    freeSlots.map(async (slots, i) => {
      const constraints = await getConstraints(userIds[i]!, eventTypeId);
      return applyConstraints(slots, userIds[i]!, constraints);
    })
  );

  // 5. Slice into duration-sized slots
  const slicedSlots = constrainedSlots.map((slots) =>
    sliceIntoSlots(slots, durationMinutes)
  );

  // 6. Handle assignment type
  if (eventTypeId) {
    const eventType = await db.eventType.findUnique({
      where: { id: eventTypeId },
    });

    if (eventType?.assignmentType === 'COLLECTIVE') {
      return findCollectiveSlots(slicedSlots, userIds);
    } else if (eventType?.assignmentType === 'ROUND_ROBIN') {
      return assignRoundRobin(slicedSlots, userIds, eventTypeId);
    }
  }

  // Single host - return their slots
  const firstSlots = slicedSlots[0];
  if (!firstSlots || userIds.length === 0) {
    return [];
  }
  return firstSlots.map((slot) => ({ ...slot, hostIds: [userIds[0]!] }));
}

/**
 * Get collective availability for multiple users
 */
export async function getCollectiveAvailability(
  userIds: string[],
  startDate: Date,
  endDate: Date,
  durationMinutes: number,
  timezone: string
): Promise<TimeSlot[]> {
  // Get individual availability for each user
  const allSlots = await Promise.all(
    userIds.map(async (userId) => {
      const result = await getAvailability({
        userIds: [userId],
        startDate,
        endDate,
        durationMinutes,
        timezone,
      });
      return result as TimeRange[];
    })
  );

  return findCollectiveSlots(allSlots, userIds);
}
