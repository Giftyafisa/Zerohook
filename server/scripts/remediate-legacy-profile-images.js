/*
 * Targeted remediation for legacy broken /uploads profile image paths.
 *
 * Default mode is dry-run. Use --apply to persist updates.
 *
 * Strategy:
 * 1) Find users that still reference known broken legacy upload paths.
 * 2) Prefer a Cloudinary image from profile_data or latest fileuploads record.
 * 3) Fall back to a stable default placeholder image.
 */

const {
  connectDB,
  mongoose,
  User,
  FileUpload,
} = require('../config/database');

const APPLY = process.argv.includes('--apply');

const TARGET_FILE_NAMES = [
  'profilePicture-1775218187500-779797838.png',
  'profilePicture-1775727084328-142146572.jpeg',
  'profilePicture-1776170558986-926065414.jpg',
];

const LEGACY_PROFILE_FILENAME_REGEX = /^profilepicture-\d+-\d+\.(png|jpe?g|webp|gif)$/i;
const LEGACY_PROFILE_VALUE_REGEX = /profilepicture-\d+-\d+\.(png|jpe?g|webp|gif)(?:\?.*)?$/i;

const TARGET_VALUES = TARGET_FILE_NAMES.flatMap((name) => ([
  `/uploads/${name}`,
  `https://zerohook-api-eoyr.onrender.com/uploads/${name}`,
  `https://zerohook-api-f3ss.onrender.com/uploads/${name}`,
]));

const DEFAULT_PLACEHOLDER_URL =
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face&auto=format&q=80';

const isCloudinaryUrl = (value) =>
  typeof value === 'string' && value.includes('cloudinary.com');

const normalizeString = (value) =>
  typeof value === 'string' ? value.trim() : '';

const extractCloudinaryFromProfileData = (profileData = {}) => {
  const candidates = [];

  if (Array.isArray(profileData.photos)) {
    candidates.push(...profileData.photos.map(normalizeString));
  }

  candidates.push(normalizeString(profileData.profilePicture));
  candidates.push(normalizeString(profileData.profile_image));
  candidates.push(normalizeString(profileData.profile_image_url));

  if (profileData.profile_picture && typeof profileData.profile_picture === 'object') {
    candidates.push(normalizeString(profileData.profile_picture.url));
  } else {
    candidates.push(normalizeString(profileData.profile_picture));
  }

  return candidates.find(isCloudinaryUrl) || null;
};

const findLatestCloudinaryUpload = async (userId) => {
  const upload = await FileUpload.findOne({
    user_id: userId,
    $or: [
      { storage_type: 'cloudinary' },
      { cloudinary_public_id: { $exists: true, $ne: null } },
      { file_path: /cloudinary\.com/i },
    ],
  })
    .sort({ created_at: -1 })
    .select('file_path storage_type upload_type created_at')
    .lean();

  const path = normalizeString(upload?.file_path);
  return isCloudinaryUrl(path) ? path : null;
};

const isLegacyBrokenUploadValue = (value) => {
  const normalized = normalizeString(value);
  if (!normalized) return false;
  if (TARGET_VALUES.includes(normalized)) return true;

  const withoutQuery = normalized.split('?')[0];
  const filename = withoutQuery.split('/').pop() || '';

  if (!LEGACY_PROFILE_FILENAME_REGEX.test(filename)) {
    return false;
  }

  if (isCloudinaryUrl(normalized)) {
    return false;
  }

  return (
    withoutQuery.startsWith('/uploads/') ||
    withoutQuery.startsWith('uploads/') ||
    /\/uploads\//i.test(withoutQuery) ||
    LEGACY_PROFILE_VALUE_REGEX.test(normalized)
  );
};

const legacyPathsPresent = (profileData = {}) => {
  const bucket = [];

  if (Array.isArray(profileData.photos)) {
    bucket.push(...profileData.photos.map(normalizeString));
  }

  bucket.push(normalizeString(profileData.profilePicture));
  bucket.push(normalizeString(profileData.profile_image));
  bucket.push(normalizeString(profileData.profile_image_url));

  if (profileData.profile_picture && typeof profileData.profile_picture === 'object') {
    bucket.push(normalizeString(profileData.profile_picture.url));
  } else {
    bucket.push(normalizeString(profileData.profile_picture));
  }

  return bucket.filter((value) => isLegacyBrokenUploadValue(value));
};

const run = async () => {
  console.log('--- Legacy Profile Image Remediation ---');
  console.log(`mode=${APPLY ? 'apply' : 'dry-run'}`);

  const dbConnected = await connectDB();
  if (!dbConnected) {
    throw new Error('Database unavailable. Verify MONGODB_URI/network and retry.');
  }

  const broadLegacyPathRegex = /profilepicture-\d+-\d+\.(png|jpe?g|webp|gif)(?:\?.*)?$/i;

  const users = await User.find({
    $or: [
      { 'profile_data.photos': { $in: TARGET_VALUES } },
      { 'profile_data.profilePicture': { $in: TARGET_VALUES } },
      { 'profile_data.profile_picture.url': { $in: TARGET_VALUES } },
      { 'profile_data.profile_picture': { $in: TARGET_VALUES } },
      { 'profile_data.photos': broadLegacyPathRegex },
      { 'profile_data.profilePicture': broadLegacyPathRegex },
      { 'profile_data.profile_picture.url': broadLegacyPathRegex },
      { 'profile_data.profile_picture': broadLegacyPathRegex },
      { 'profile_data.profile_image': broadLegacyPathRegex },
      { 'profile_data.profile_image_url': broadLegacyPathRegex },
      { 'profileData.photos': broadLegacyPathRegex },
      { 'profileData.profilePicture': broadLegacyPathRegex },
      { 'profileData.profile_picture.url': broadLegacyPathRegex },
      { 'profileData.profile_picture': broadLegacyPathRegex },
      { 'profileData.profile_image': broadLegacyPathRegex },
      { 'profileData.profile_image_url': broadLegacyPathRegex },
    ],
  })
    .select('_id username profile_data')
    .lean();

  console.log(`matchedUsers=${users.length}`);

  const results = [];

  for (const user of users) {
    const profileData = user.profile_data || {};
    const matchedLegacyPaths = legacyPathsPresent(profileData);
    if (matchedLegacyPaths.length === 0) {
      continue;
    }

    const existingCloudinary = extractCloudinaryFromProfileData(profileData);
    const uploadCloudinary = existingCloudinary || await findLatestCloudinaryUpload(user._id);
    const replacementUrl = uploadCloudinary || DEFAULT_PLACEHOLDER_URL;

    const replacementSource = uploadCloudinary ? 'cloudinary' : 'default_placeholder';
    const updatedProfilePicture =
      profileData.profile_picture && typeof profileData.profile_picture === 'object'
        ? {
            ...profileData.profile_picture,
            url: replacementUrl,
            storageType: uploadCloudinary ? 'cloudinary' : 'placeholder',
          }
        : {
            url: replacementUrl,
            storageType: uploadCloudinary ? 'cloudinary' : 'placeholder',
          };

    const updateDoc = {
      'profile_data.photos': [replacementUrl],
      'profile_data.profilePicture': replacementUrl,
      'profile_data.profile_picture': updatedProfilePicture,
    };

    if (APPLY) {
      await User.updateOne({ _id: user._id }, { $set: updateDoc });
    }

    results.push({
      userId: String(user._id),
      username: user.username,
      matchedLegacyPaths,
      replacementSource,
      replacementUrl,
      applied: APPLY,
    });
  }

  console.log('--- Remediation Summary ---');
  results.forEach((item, index) => {
    console.log(
      `${index + 1}. ${item.username} (${item.userId}) -> ${item.replacementSource} -> ${item.replacementUrl}`
    );
    if (item.matchedLegacyPaths.length > 0) {
      console.log(`   legacy: ${item.matchedLegacyPaths.join(', ')}`);
    }
  });

  console.log(`updatedCount=${results.length}`);
  console.log(`status=${APPLY ? 'APPLIED' : 'DRY_RUN_ONLY'}`);
};

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('remediation_failed:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
