-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "topProducts" JSONB NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isBoosted" BOOLEAN NOT NULL DEFAULT false,
    "boostedUntil" TIMESTAMP(3),

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphicKit" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productImage" TEXT NOT NULL,
    "promotionText" TEXT NOT NULL,
    "deepLink" TEXT,
    "shortHash" TEXT,
    "imageUrls" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GraphicKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "screenshotUrl" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incentive" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incentive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GraphicKit_shortHash_key" ON "GraphicKit"("shortHash");

-- CreateIndex
CREATE UNIQUE INDEX "Verification_kitId_key" ON "Verification"("kitId");

-- CreateIndex
CREATE UNIQUE INDEX "Incentive_kitId_key" ON "Incentive"("kitId");

-- AddForeignKey
ALTER TABLE "GraphicKit" ADD CONSTRAINT "GraphicKit_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "GraphicKit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incentive" ADD CONSTRAINT "Incentive_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incentive" ADD CONSTRAINT "Incentive_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "GraphicKit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
