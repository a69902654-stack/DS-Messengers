<img src="https://rozup.ir/view/4265174/-2147483648_-210883.jpg">
# 🚀 DS Messenger

**DS Messenger** is a modern, secure, and intelligent messaging application built with **React Native (Expo)** and **Supabase**.  
It goes beyond simple chatting by integrating **real-time messaging**, **file sharing**, **music playback**, and **on-device AI** — all in one seamless experience.

---

## ✨ Features

### 🔐 Authentication
- Sign up / Sign in with email or phone number
- Smooth animated transitions
- Password recovery

### 💬 Real-time Messaging
- Send text, images, videos, GIFs, and files (PDF, ZIP, etc.)
- Online / offline status
- Typing indicator
- Read receipts (✔️✔️)
- Reply and forward messages
- Search message history

### 👥 Group Chats
- Create groups with name and avatar
- Add / remove members
- Admin roles with custom permissions
- Invite links
- Public / private group settings

### 👤 Profile & Settings
- Edit user profile
- Upload profile picture
- Privacy controls
- Dark / Light theme
- Change password

### 🎵 Built-in Music Player
- Access device music library
- Background playback
- Create and manage playlists
- Display lyrics
- Playback controls (Play/Pause/Next/Previous)

### 🧠 On-Device AI
- Summarize long messages
- Auto-translate between Persian and English
- Smart reply suggestions
- Sentiment analysis
- Spell and grammar check
- Auto-reminders for important messages

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React Native + Expo |
| **Backend & Database** | Supabase (PostgreSQL + Realtime) |
| **File Storage** | Supabase Storage |
| **Authentication** | Supabase Auth |
| **Music Playback** | Expo AV |
| **Animations** | React Native Reanimated 3 + Lottie |
| **AI** | Local models (Gemini Nano / ONNX) |

---

## 🧩 Project Structure
DS/
├── app/ # Expo Router pages
│ ├── (tabs)/ # Main tab navigation
│ ├── auth/ # Authentication screens
│ ├── chat/ # Chat screens
│ └── profile/ # Profile screens
├── assets/ # Images, fonts, etc.
├── components/ # Reusable UI components
├── config/ # Supabase client config
├── hooks/ # Custom React hooks
├── utils/ # Helper functions
├── app.json # Expo configuration
└── package.json # Dependencies

text

---

## 🚦 Getting Started

### Prerequisites
- Node.js (v18 or later)
- npm or yarn
- Expo CLI
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/a69902654-stack/DS.git
   cd DS
Install dependencies

bash
npm install
Configure Supabase

Create a .env file in the root directory:

text
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
Start the development server

bash
npx expo start
Run on device

Scan QR code with Expo Go (Android)

Or press a for Android emulator

📦 Building APK
Using EAS Build (Cloud)
bash
eas build --platform android --profile preview
Using Local Gradle
bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
The APK will be located at:

text
android/app/build/outputs/apk/release/app-release.apk
🗺 Roadmap
Authentication (Sign up / Sign in)

Real-time private messaging

Group chat with admin controls

File sharing (images, videos, documents)

Profile & settings

Music player with background playback

On-device AI assistant

Voice & video calls (WebRTC)

Ephemeral messages

End-to-end encryption

Multi-language support

🤝 Contributing
Contributions are welcome!
Please open an issue or submit a pull request for any improvements.

Fork the repository

Create a feature branch (git checkout -b feature/AmazingFeature)

Commit your changes (git commit -m 'Add some AmazingFeature')

Push to the branch (git push origin feature/AmazingFeature)

Open a Pull Request

📬 Contact
Developer: Amirarsalan Dolatsha
Email: amiraarsalan1566@gmail.com
GitHub: a69902654-stack
Portfolio: amir-arsalan.netlify.app

📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

🙏 Acknowledgements
Expo

Supabase

React Native

React Native Reanimated

⭐ If you like this project, give it a star on GitHub! ⭐
