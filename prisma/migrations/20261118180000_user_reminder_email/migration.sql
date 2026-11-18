-- Optional study-reminder destination; null means deliver to User.email
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reminderEmail" TEXT;
