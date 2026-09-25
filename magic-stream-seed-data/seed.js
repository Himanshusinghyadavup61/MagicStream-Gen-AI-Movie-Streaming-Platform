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

function loadJsonFile(fileName) {
  const filePath = path.join(__dirname, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const rawData = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(rawData);
}

async function seedAll() {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log(`Connected successfully to MongoDB Atlas (${dbName})\n`);

    const db = client.db(dbName);

    // 1. Seed Genres
    console.log('--- Seeding Genres ---');
    const genresData = loadJsonFile('genres.json');
    const genresCollection = db.collection('genres');
    for (const genre of genresData) {
      await genresCollection.updateOne(
        { genre_id: genre.genre_id },
        { $set: genre },
        { upsert: true }
      );
    }
    const genresCount = await genresCollection.countDocuments();
    console.log(`✓ Processed ${genresData.length} genres. Total in collection: ${genresCount}\n`);

    // 2. Seed Rankings
    console.log('--- Seeding Rankings ---');
    const rankingsData = loadJsonFile('rankings.json');
    const rankingsCollection = db.collection('rankings');
    for (const ranking of rankingsData) {
      await rankingsCollection.updateOne(
        { ranking_value: ranking.ranking_value },
        { $set: ranking },
        { upsert: true }
      );
    }
    const rankingsCount = await rankingsCollection.countDocuments();
    console.log(`✓ Processed ${rankingsData.length} rankings. Total in collection: ${rankingsCount}\n`);

    // 3. Seed Movies
    console.log('--- Seeding Movies ---');
    const moviesData = loadJsonFile('movies.json');
    const moviesCollection = db.collection('movies');
    for (const movie of moviesData) {
      await moviesCollection.updateOne(
        { imdb_id: movie.imdb_id },
        { $set: movie },
        { upsert: true }
      );
    }
    const moviesCount = await moviesCollection.countDocuments();
    console.log(`✓ Processed ${moviesData.length} movies. Total in collection: ${moviesCount}\n`);

    // 4. Seed Users
    console.log('--- Seeding Users ---');
    const usersData = loadJsonFile('users.json');
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

      await usersCollection.updateOne(
        { email: user.email },
        { $set: userDoc },
        { upsert: true }
      );
    }
    const usersCount = await usersCollection.countDocuments();
    console.log(`✓ Processed ${usersData.length} users. Total in collection: ${usersCount}\n`);

    console.log('====================================');
    console.log('All seed data successfully migrated to MongoDB Atlas!');
    console.log('====================================');
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  } finally {
    await client.close();
    console.log('MongoDB connection closed.');
  }
}

seedAll();
