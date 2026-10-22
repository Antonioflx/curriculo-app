-- CreateEnum
CREATE TYPE "ResumeKind" AS ENUM ('BASE', 'ADJUSTED');

-- CreateEnum
CREATE TYPE "ResumeStatus" AS ENUM ('DRAFT', 'SAVED');

-- CreateEnum
CREATE TYPE "SuggestionKind" AS ENUM ('EMPHASIS', 'FACT_QUESTION');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'ANSWERED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('EMAIL', 'ANSWER');

-- CreateEnum
CREATE TYPE "WritingTone" AS ENUM ('OBJETIVO', 'DETALHADO');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "familyId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resume" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "ResumeKind" NOT NULL,
    "status" "ResumeStatus",
    "parentId" UUID,
    "jobId" UUID,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeTag" (
    "resumeId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "ResumeTag_pkey" PRIMARY KEY ("resumeId","tagId")
);

-- CreateTable
CREATE TABLE "JobPosting" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "rawText" TEXT,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "contactEmail" TEXT,
    "extracted" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "recommendedResumeId" UUID NOT NULL,
    "result" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" UUID NOT NULL,
    "analysisId" UUID NOT NULL,
    "kind" "SuggestionKind" NOT NULL,
    "target" TEXT NOT NULL,
    "proposal" TEXT NOT NULL,
    "question" TEXT,
    "answer" TEXT,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "promoteToBase" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedMessage" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "resumeId" UUID NOT NULL,
    "type" "MessageType" NOT NULL,
    "question" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingSettings" (
    "userId" UUID NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "tone" "WritingTone" NOT NULL DEFAULT 'OBJETIVO',
    "opening" TEXT,
    "signature" TEXT,

    CONSTRAINT "WritingSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_familyId_idx" ON "Session"("familyId");

-- CreateIndex
CREATE INDEX "Resume_userId_kind_idx" ON "Resume"("userId", "kind");

-- CreateIndex
CREATE INDEX "Resume_parentId_idx" ON "Resume"("parentId");

-- CreateIndex
CREATE INDEX "Resume_jobId_idx" ON "Resume"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_userId_name_key" ON "Tag"("userId", "name");

-- CreateIndex
CREATE INDEX "ResumeTag_tagId_idx" ON "ResumeTag"("tagId");

-- CreateIndex
CREATE INDEX "JobPosting_userId_createdAt_idx" ON "JobPosting"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Analysis_jobId_idx" ON "Analysis"("jobId");

-- CreateIndex
CREATE INDEX "Suggestion_analysisId_idx" ON "Suggestion"("analysisId");

-- CreateIndex
CREATE INDEX "GeneratedMessage_jobId_createdAt_idx" ON "GeneratedMessage"("jobId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobPosting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeTag" ADD CONSTRAINT "ResumeTag_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeTag" ADD CONSTRAINT "ResumeTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_recommendedResumeId_fkey" FOREIGN KEY ("recommendedResumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedMessage" ADD CONSTRAINT "GeneratedMessage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedMessage" ADD CONSTRAINT "GeneratedMessage_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingSettings" ADD CONSTRAINT "WritingSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
