/**
 * Create an admin account, or promote an existing account to admin.
 *   npm run create-admin -- you@example.com "a-strong-password" "Your Name"
 */
import { connectDb, disconnectDb } from '../db.js';
import { User } from '../models/index.js';

const [email, password, name = 'Administrator'] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Usage: npm run create-admin -- <email> <password of 8+ characters> ["Full Name"]');
  process.exit(1);
}

try {
  await connectDb();
  let user = await User.findOne({ email: email.toLowerCase() });
  if (!user) user = new User({ email, name });
  user.role = 'admin';
  user.disabled = false;
  await user.setPassword(password);
  await user.save();
  console.log(`Admin ready: ${user.email}. Sign in at /login.`);
} catch (err) {
  console.error('Could not create the admin:', err.message);
  process.exitCode = 1;
} finally {
  await disconnectDb();
}
