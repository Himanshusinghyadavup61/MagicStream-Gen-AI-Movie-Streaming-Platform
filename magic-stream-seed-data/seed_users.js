const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Configure reliable DNS servers to avoid SRV lookup issues on Windows
dns.setServers(['8.8.8.8', '1.1.1.1']);

const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');

// Try loading .env from current folder, Server folder, or parent folder
const envPaths = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', 'Server', 'MagicStreamServer', '.env'),
  path.join(__dirname, '..', '.env')
];

let loadedEnv = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    loadedEnv = true;
    break;
  }
}

if (!loadedEnv) {
  dotenv.config();
}

const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.DATABASE_NAME || 'magicstream';

if (!mongoUri) {
  console.error('Error: MONGODB_URI is not defined in .env');
  process.exit(1);
}

const usersFilePath = path.join(__dirname, 'users.json');
const rawData = fs.readFileSync(usersFilePath, 'utf8');
const usersData = JSON.parse(rawData);

console.log(`Loaded ${usersData.length} users from ${usersFilePath}`);

async function seedUsers() {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log(`Connected successfully to MongoDB Atlas (${dbName})`);

    const db = client.db(dbName);
    const usersCollection = db.collection('users');

    for (const user of usersData) {
      const createdAt = user.created_at && user.created_at.$date ? new Date(user.created_at.$date) : new Date();
      const updatedAt = user.updated_at && user.updated_at.$date ? new Date(user.updated_at.$date) : new Date();

      const userDoc = {
        user_id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        password: user.password,
        role: user.role,
        created_at: createdAt,
        updated_at: updatedAt,
        update_at: updatedAt,
        token: user.token || "",
        refresh_token: user.refresh_token || "",
        favourite_genres: user.favourite_genres || []
      };

      const result = await usersCollection.updateOne(
        { email: user.email },
        { $set: userDoc },
        { upsert: true }
      );

      console.log(`Upserted user: ${user.email} (${user.role}) - Matched: ${result.matchedCount}, UpsertedId: ${result.upsertedId || 'Existing'}`);
    }

    const totalCount = await usersCollection.countDocuments();
    console.log(`Total users in collection: ${totalCount}`);
  } catch (err) {
    console.error('Failed to seed users:', err);
    process.exit(1);
  } finally {
    await client.close();
    console.log('MongoDB connection closed.');
  }
}

seedUsers();
