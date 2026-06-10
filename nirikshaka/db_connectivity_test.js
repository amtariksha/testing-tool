const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    // Test 1: Query projects count
    const projectCount = await prisma.project.count();
    console.log(`\n✅ Database connected successfully!`);
    console.log(`   Total projects in DB: ${projectCount}`);

    // Test 2: Get a project with its API key
    const project = await prisma.project.findFirst({
      include: { apiKeys: true }
    });

    if (project) {
      console.log(`\n📦 Sample Project:`);
      console.log(`   Name: ${project.name}`);
      console.log(`   Platform: ${project.platform}`);
      console.log(`   Feature Flags:`);
      console.log(`     - Crash Reporting: ${project.enableCrashReporting}`);
      console.log(`     - Network Tracking: ${project.enableNetworkTracking}`);
      console.log(`     - UI Error Tracking: ${project.enableUIErrorTracking}`);
      console.log(`     - Journey Tracking: ${project.enableJourneyTracking}`);
      console.log(`     - Screenshot Detection: ${project.enableScreenshotDetection}`);
      console.log(`     - Suspended: ${project.isSuspended}`);
      
      if (project.apiKeys.length > 0) {
        console.log(`   API Key: ${project.apiKeys[0].key}`);
      }
    } else {
      console.log(`\n⚠️ No projects found in DB`);
    }

    // Test 3: Check aggregate stats (what admin panel shows)
    const stats = {
      projects: await prisma.project.count(),
      active: await prisma.project.count({ where: { isSuspended: false } }),
      suspended: await prisma.project.count({ where: { isSuspended: true } }),
      crashes: await prisma.crashLog.count(),
      uiErrors: await prisma.uIError.count(),
      apiRequests: await prisma.aPIRequest.count(),
      journeys: await prisma.userJourney.count(),
    };

    console.log(`\n📊 Platform Stats (what admin panel shows):`);
    console.log(`   Projects: ${stats.projects} (Active: ${stats.active}, Suspended: ${stats.suspended})`);
    console.log(`   Crashes: ${stats.crashes}`);
    console.log(`   UI Errors: ${stats.uiErrors}`);
    console.log(`   API Requests: ${stats.apiRequests}`);
    console.log(`   User Journeys: ${stats.journeys}`);

  } catch (e) {
    console.error('❌ Database connection failed:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
