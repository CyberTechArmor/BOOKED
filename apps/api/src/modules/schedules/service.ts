import { getPrismaClient } from '../../infrastructure/database/client.js';
import { NotFoundError, ForbiddenError } from '../../common/utils/errors.js';
import type { CreateScheduleInput, UpdateScheduleInput, ScheduleWindowInput } from './schemas.js';

export interface Schedule {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  bufferBefore: number | null;
  bufferAfter: number | null;
  minimumNotice: number | null;
  maxBookingsPerDay: number | null;
  maxBookingsPerWeek: number | null;
  windows: ScheduleWindow[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduleWindow {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  specificDate: Date | null;
  isAvailable: boolean;
}

export async function getUserSchedules(userId: string): Promise<Schedule[]> {
  const db = getPrismaClient();

  const schedules = await db.userSchedule.findMany({
    where: { userId },
    include: { windows: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });

  return schedules.map((s) => ({
    id: s.id,
    userId: s.userId,
    name: s.name,
    isDefault: s.isDefault,
    bufferBefore: s.bufferBefore,
    bufferAfter: s.bufferAfter,
    minimumNotice: s.minimumNotice,
    maxBookingsPerDay: s.maxBookingsPerDay,
    maxBookingsPerWeek: s.maxBookingsPerWeek,
    windows: s.windows.map((w) => ({
      id: w.id,
      dayOfWeek: w.dayOfWeek,
      startTime: w.startTime,
      endTime: w.endTime,
      specificDate: w.specificDate,
      isAvailable: w.isAvailable,
    })),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
}

export async function getScheduleById(
  scheduleId: string,
  userId: string
): Promise<Schedule> {
  const db = getPrismaClient();

  const schedule = await db.userSchedule.findUnique({
    where: { id: scheduleId },
    include: { windows: true },
  });

  if (!schedule || schedule.userId !== userId) {
    throw new NotFoundError('Schedule not found');
  }

  return {
    id: schedule.id,
    userId: schedule.userId,
    name: schedule.name,
    isDefault: schedule.isDefault,
    bufferBefore: schedule.bufferBefore,
    bufferAfter: schedule.bufferAfter,
    minimumNotice: schedule.minimumNotice,
    maxBookingsPerDay: schedule.maxBookingsPerDay,
    maxBookingsPerWeek: schedule.maxBookingsPerWeek,
    windows: schedule.windows.map((w) => ({
      id: w.id,
      dayOfWeek: w.dayOfWeek,
      startTime: w.startTime,
      endTime: w.endTime,
      specificDate: w.specificDate,
      isAvailable: w.isAvailable,
    })),
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}

export async function createSchedule(
  userId: string,
  input: CreateScheduleInput
): Promise<Schedule> {
  const db = getPrismaClient();

  // If this is the default schedule, unset other defaults
  if (input.isDefault) {
    await db.userSchedule.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const schedule = await db.userSchedule.create({
    data: {
      userId,
      name: input.name,
      isDefault: input.isDefault ?? false,
      bufferBefore: input.bufferBefore,
      bufferAfter: input.bufferAfter,
      minimumNotice: input.minimumNotice,
      maxBookingsPerDay: input.maxBookingsPerDay,
      maxBookingsPerWeek: input.maxBookingsPerWeek,
      windows: input.windows
        ? {
            create: input.windows.map((w) => ({
              dayOfWeek: w.dayOfWeek,
              startTime: w.startTime,
              endTime: w.endTime,
              specificDate: w.specificDate ? new Date(w.specificDate) : null,
              isAvailable: w.isAvailable,
            })),
          }
        : undefined,
    },
    include: { windows: true },
  });

  return {
    id: schedule.id,
    userId: schedule.userId,
    name: schedule.name,
    isDefault: schedule.isDefault,
    bufferBefore: schedule.bufferBefore,
    bufferAfter: schedule.bufferAfter,
    minimumNotice: schedule.minimumNotice,
    maxBookingsPerDay: schedule.maxBookingsPerDay,
    maxBookingsPerWeek: schedule.maxBookingsPerWeek,
    windows: schedule.windows.map((w) => ({
      id: w.id,
      dayOfWeek: w.dayOfWeek,
      startTime: w.startTime,
      endTime: w.endTime,
      specificDate: w.specificDate,
      isAvailable: w.isAvailable,
    })),
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}

export async function updateSchedule(
  scheduleId: string,
  userId: string,
  input: UpdateScheduleInput
): Promise<Schedule> {
  const db = getPrismaClient();

  const existing = await db.userSchedule.findUnique({
    where: { id: scheduleId },
  });

  if (!existing || existing.userId !== userId) {
    throw new NotFoundError('Schedule not found');
  }

  // If setting as default, unset other defaults
  if (input.isDefault) {
    await db.userSchedule.updateMany({
      where: { userId, isDefault: true, id: { not: scheduleId } },
      data: { isDefault: false },
    });
  }

  // Handle windows update - delete and recreate if provided
  if (input.windows !== undefined) {
    await db.scheduleWindow.deleteMany({
      where: { scheduleId },
    });
  }

  const schedule = await db.userSchedule.update({
    where: { id: scheduleId },
    data: {
      name: input.name,
      isDefault: input.isDefault,
      bufferBefore: input.bufferBefore,
      bufferAfter: input.bufferAfter,
      minimumNotice: input.minimumNotice,
      maxBookingsPerDay: input.maxBookingsPerDay,
      maxBookingsPerWeek: input.maxBookingsPerWeek,
      windows: input.windows
        ? {
            create: input.windows.map((w) => ({
              dayOfWeek: w.dayOfWeek,
              startTime: w.startTime,
              endTime: w.endTime,
              specificDate: w.specificDate ? new Date(w.specificDate) : null,
              isAvailable: w.isAvailable,
            })),
          }
        : undefined,
    },
    include: { windows: true },
  });

  return {
    id: schedule.id,
    userId: schedule.userId,
    name: schedule.name,
    isDefault: schedule.isDefault,
    bufferBefore: schedule.bufferBefore,
    bufferAfter: schedule.bufferAfter,
    minimumNotice: schedule.minimumNotice,
    maxBookingsPerDay: schedule.maxBookingsPerDay,
    maxBookingsPerWeek: schedule.maxBookingsPerWeek,
    windows: schedule.windows.map((w) => ({
      id: w.id,
      dayOfWeek: w.dayOfWeek,
      startTime: w.startTime,
      endTime: w.endTime,
      specificDate: w.specificDate,
      isAvailable: w.isAvailable,
    })),
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}

export async function deleteSchedule(
  scheduleId: string,
  userId: string
): Promise<void> {
  const db = getPrismaClient();

  const existing = await db.userSchedule.findUnique({
    where: { id: scheduleId },
  });

  if (!existing || existing.userId !== userId) {
    throw new NotFoundError('Schedule not found');
  }

  // Check if this is the only schedule
  const scheduleCount = await db.userSchedule.count({
    where: { userId },
  });

  if (scheduleCount <= 1) {
    throw new ForbiddenError('Cannot delete the only schedule');
  }

  // If deleting default, set another as default
  if (existing.isDefault) {
    const anotherSchedule = await db.userSchedule.findFirst({
      where: { userId, id: { not: scheduleId } },
    });
    if (anotherSchedule) {
      await db.userSchedule.update({
        where: { id: anotherSchedule.id },
        data: { isDefault: true },
      });
    }
  }

  await db.userSchedule.delete({
    where: { id: scheduleId },
  });
}

export async function addScheduleWindow(
  scheduleId: string,
  userId: string,
  input: ScheduleWindowInput
): Promise<ScheduleWindow> {
  const db = getPrismaClient();

  const schedule = await db.userSchedule.findUnique({
    where: { id: scheduleId },
  });

  if (!schedule || schedule.userId !== userId) {
    throw new NotFoundError('Schedule not found');
  }

  const window = await db.scheduleWindow.create({
    data: {
      scheduleId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      specificDate: input.specificDate ? new Date(input.specificDate) : null,
      isAvailable: input.isAvailable,
    },
  });

  return {
    id: window.id,
    dayOfWeek: window.dayOfWeek,
    startTime: window.startTime,
    endTime: window.endTime,
    specificDate: window.specificDate,
    isAvailable: window.isAvailable,
  };
}

export async function deleteScheduleWindow(
  scheduleId: string,
  windowId: string,
  userId: string
): Promise<void> {
  const db = getPrismaClient();

  const schedule = await db.userSchedule.findUnique({
    where: { id: scheduleId },
    include: { windows: { where: { id: windowId } } },
  });

  if (!schedule || schedule.userId !== userId) {
    throw new NotFoundError('Schedule not found');
  }

  if (schedule.windows.length === 0) {
    throw new NotFoundError('Window not found');
  }

  await db.scheduleWindow.delete({
    where: { id: windowId },
  });
}
