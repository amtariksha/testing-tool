const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    console.log("🧹 Starting complete database clearance...");
    
    // 1. Delete journey events
    const deletedEvents = await prisma.journeyEvent.deleteMany({});
    console.log(`   - Deleted ${deletedEvents.count} journey events.`);
    
    // 2. Delete user journeys
    const deletedJourneys = await prisma.userJourney.deleteMany({});
    console.log(`   - Deleted ${deletedJourneys.count} user journeys.`);
    
    // 3. Delete crash logs
    const deletedCrashes = await prisma.crashLog.deleteMany({});
    console.log(`   - Deleted ${deletedCrashes.count} crash logs.`);
    
    // 4. Delete UI errors
    const deletedUiErrors = await prisma.uIError.deleteMany({});
    console.log(`   - Deleted ${deletedUiErrors.count} UI errors.`);
    
    // 5. Delete API requests
    const deletedApiRequests = await prisma.aPIRequest.deleteMany({});
    console.log(`   - Deleted ${deletedApiRequests.count} API requests.`);
    
    // 6. Delete SDK installations
    const deletedInstalls = await prisma.sDKInstallation.deleteMany({});
    console.log(`   - Deleted ${deletedInstalls.count} SDK installations.`);
    
    // 7. Delete API keys
    const deletedKeys = await prisma.aPIKey.deleteMany({});
    console.log(`   - Deleted ${deletedKeys.count} API keys.`);
    
    // 8. Delete projects
    const deletedProjects = await prisma.project.deleteMany({});
    console.log(`   - Deleted ${deletedProjects.count} projects.`);
    
    // 9. Delete team members
    const deletedMembers = await prisma.teamMember.deleteMany({});
    console.log(`   - Deleted ${deletedMembers.count} team members.`);
    
    // 10. Delete teams (companies)
    const deletedTeams = await prisma.team.deleteMany({});
    console.log(`   - Deleted ${deletedTeams.count} teams/companies.`);
    
    // 11. Delete users
    const deletedUsers = await prisma.user.deleteMany({});
    console.log(`   - Deleted ${deletedUsers.count} users.`);
    
    console.log("✅ Database completely cleared!");
  } catch (e) {
    console.error("❌ Complete database clearance failed:", e.message);
  } finally {
    await pool.end();
  }
}

main();
