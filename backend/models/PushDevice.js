import mongoose from "mongoose";

// One row per iPhone that registered for Apple push (APNs) while signed in.
const LiveActivitySchema = new mongoose.Schema(
  {
    appointmentId: { type: String, required: true },
    // Update token for a running Live Activity (null until the phone reports it)
    token: { type: String, default: null },
    // Set when the server asked iOS to start this activity remotely, so it only asks once
    remoteStartAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const PushDeviceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    platform: { type: String, default: "ios" },
    deviceToken: { type: String, required: true, unique: true },
    // "sandbox" for Xcode/debug builds, "production" for TestFlight/App Store.
    // The sender flips it automatically if APNs rejects the token in one environment.
    environment: { type: String, enum: ["sandbox", "production"], default: "production" },
    bundleId: { type: String },
    // iOS 17.2+: lets the server start a Live Activity without the app being open
    pushToStartToken: { type: String, default: null },
    liveActivities: { type: [LiveActivitySchema], default: [] }
  },
  { timestamps: true }
);

export default mongoose.model("PushDevice", PushDeviceSchema);
