-- CreateTable
CREATE TABLE "BulkBatch" (
    "id"         TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status"     TEXT NOT NULL,
    "totalRows"  INTEGER NOT NULL,
    "successful" INTEGER NOT NULL DEFAULT 0,
    "failed"     INTEGER NOT NULL DEFAULT 0,
    "zipUrl"     TEXT,
    "previews"   JSONB,
    "errors"     JSONB,

    CONSTRAINT "BulkBatch_pkey" PRIMARY KEY ("id")
);
