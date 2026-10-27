import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { users, complaints, complaintStatusHistory, notifications } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const DATABASE_URL = process.env.DATABASE_URL || "mysql://ccms:ccmspass@localhost:3306/ccms";

function consumerId() {
  const stamp = new Date();
  const year = stamp.getUTCFullYear();
  const uuid = crypto.randomUUID().replace(/-/g, "").slice(0, 6);
  const suffix = parseInt(uuid, 16) % 900000 + 100000;
  return `CCMS-${year}-${suffix}`;
}

async function seed() {
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  console.log("🌱 Seeding development data...");

  // 1. Create dev users (idempotent)
  console.log("Creating dev users...");
  
  const studentUser = await db.select().from(users).where(eq(users.openId, "dev-student@ccms.local")).limit(1);
  let studentId: number;
  if (studentUser.length === 0) {
    const result = await connection.execute(
      `INSERT INTO users (openId, name, email, loginMethod, role, lastSignedIn) 
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), role=VALUES(role)`,
      ["dev-student@ccms.local", "Demo Student", "student@ccms.local", "dev", "user", new Date()]
    );
    studentId = (result[0] as any).insertId;
    console.log(`Created student with ID: ${studentId}`);
  } else {
    studentId = studentUser[0].id;
    console.log(`Student already exists with ID: ${studentId}`);
  }

  const staffUser = await db.select().from(users).where(eq(users.openId, "dev-staff@ccms.local")).limit(1);
  let staffId: number;
  if (staffUser.length === 0) {
    const result = await connection.execute(
      `INSERT INTO users (openId, name, email, loginMethod, role, lastSignedIn) 
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), role=VALUES(role)`,
      ["dev-staff@ccms.local", "Demo Staff", "staff@ccms.local", "dev", "admin", new Date()]
    );
    staffId = (result[0] as any).insertId;
    console.log(`Created staff with ID: ${staffId}`);
  } else {
    staffId = staffUser[0].id;
    console.log(`Staff already exists with ID: ${staffId}`);
  }

  // 2. Create sample complaints
  console.log("Creating sample complaints...");

  const sampleComplaints = [
    {
      category: "Facilities",
      title: "Water leakage in east wing washroom",
      description: "There is a significant water leak in the east wing washroom on the 2nd floor. Water is pooling on the floor and dripping from the ceiling. This creates a slipping hazard and potential water damage.",
      location: "Block C · East wing · 2nd floor washroom",
      priority: "High" as const,
    },
    {
      category: "IT",
      title: "Classroom projector not working",
      description: "The projector in Studio 204 does not turn on. Tried multiple input sources and cables. The power light doesn't even come on. This is blocking several classes.",
      location: "Design Block · Studio 204",
      priority: "Medium" as const,
    },
    {
      category: "Facilities",
      title: "Library air conditioning issue",
      description: "The air conditioning in the main library reading room has been blowing warm air for the past 3 days. Temperature is around 28°C making it uncomfortable for students studying.",
      location: "Main Library · Reading Room",
      priority: "Medium" as const,
    },
  ];

  for (const complaint of sampleComplaints) {
    // Check if complaint already exists (by title)
    const existing = await db.select().from(complaints).where(eq(complaints.title, complaint.title)).limit(1);
    if (existing.length > 0) {
      console.log(`Complaint "${complaint.title}" already exists, skipping...`);
      continue;
    }

    const id = consumerId();
    const now = new Date();
    const createdAt = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Random time within last week
    const updatedAt = new Date(createdAt.getTime() + Math.random() * 2 * 24 * 60 * 60 * 1000); // Updated 0-2 days after creation

    // Insert complaint
    await connection.execute(
      `INSERT INTO complaints (consumerId, studentId, category, title, description, location, priority, status, isAnonymous, createdAt, updatedAt, resolvedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, studentId, complaint.category, complaint.title, complaint.description, complaint.location, complaint.priority, "Pending", false, createdAt, updatedAt, null]
    );

    // Get the inserted complaint ID
    const [complaintResult] = await connection.execute(
      `SELECT id FROM complaints WHERE consumerId = ?`,
      [id]
    );
    const complaintId = (complaintResult as any[])[0].id;

    // Insert initial status history
    await connection.execute(
      `INSERT INTO complaint_status_history (complaintId, changedByUserId, oldStatus, newStatus, remarks, changedAt) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [complaintId, studentId, null, "Pending", "Complaint submitted", createdAt]
    );

    // Insert notification
    await connection.execute(
      `INSERT INTO notifications (userId, complaintId, type, message, isRead, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [studentId, complaintId, "submitted", `Complaint ${id} was submitted and is pending triage.`, false, createdAt]
    );

    // Update status for some complaints
    if (complaint.title === "Water leakage in east wing washroom") {
      const inProgressAt = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
      await connection.execute(
        `UPDATE complaints SET status = ?, updatedAt = ? WHERE id = ?`,
        ["In Progress", inProgressAt, complaintId]
      );
      await connection.execute(
        `INSERT INTO complaint_status_history (complaintId, changedByUserId, oldStatus, newStatus, remarks, changedAt) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [complaintId, staffId, "Pending", "In Progress", "Assigned to facilities team", inProgressAt]
      );
      await connection.execute(
        `INSERT INTO notifications (userId, complaintId, type, message, isRead, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [studentId, complaintId, "status_changed", `Complaint ${id} is now In Progress.`, false, inProgressAt]
      );
    }

    if (complaint.title === "Library air conditioning issue") {
      const resolvedAt = new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days later
      await connection.execute(
        `UPDATE complaints SET status = ?, updatedAt = ?, resolvedAt = ? WHERE id = ?`,
        ["Resolved", resolvedAt, resolvedAt, complaintId]
      );
      await connection.execute(
        `INSERT INTO complaint_status_history (complaintId, changedByUserId, oldStatus, newStatus, remarks, changedAt) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [complaintId, staffId, "Pending", "Resolved", "AC unit repaired and tested", resolvedAt]
      );
      await connection.execute(
        `INSERT INTO notifications (userId, complaintId, type, message, isRead, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [studentId, complaintId, "status_changed", `Complaint ${id} is now Resolved.`, false, resolvedAt]
      );

      // Add feedback for resolved complaint
      await connection.execute(
        `INSERT INTO feedback (complaintId, studentId, rating, comments, createdAt) 
         VALUES (?, ?, ?, ?, ?)`,
        [complaintId, studentId, 5, "Quick resolution, thank you!", resolvedAt]
      );
    }

    console.log(`Created complaint: ${id} - ${complaint.title}`);
  }

  console.log("✅ Seeding complete!");

  // Print summary
  const [userCount] = await connection.execute(`SELECT COUNT(*) as count FROM users`);
  const [complaintCount] = await connection.execute(`SELECT COUNT(*) as count FROM complaints`);
  const [notificationCount] = await connection.execute(`SELECT COUNT(*) as count FROM notifications`);

  console.log(`\n📊 Summary:`);
  console.log(`   Users: ${(userCount as any[])[0].count}`);
  console.log(`   Complaints: ${(complaintCount as any[])[0].count}`);
  console.log(`   Notifications: ${(notificationCount as any[])[0].count}`);

  await connection.end();
}

seed().catch(console.error);