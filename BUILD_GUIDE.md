# Complete Build Guide - Expo + Next.js + Express.js

## 🎯 Overview
This guide covers building production-ready versions of your healthcare application stack.

---

## 📱 1. EXPO (React Native Mobile App)

### Prerequisites
```bash
npm install -g eas-cli
eas login
```

### Development Build
```bash
# Navigate to your Expo project
cd your-expo-app

# Install dependencies
npm install

# Start development server
npx expo start
```

### Production Build

#### Option A: Using EAS Build (Recommended)
```bash
# Configure EAS
eas build:configure

# Build for Android
eas build --platform android --profile production

# Build for iOS (requires Apple Developer Account)
eas build --platform ios --profile production

# Build for both platforms
eas build --platform all --profile production
```

#### Option B: Local Build
```bash
# Android APK
npx expo build:android -t apk

# Android AAB (for Play Store)
npx expo build:android -t app-bundle

# iOS (requires Mac)
npx expo build:ios
```

### Configuration Files

**eas.json** (create in root):
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "simulator": false
      }
    }
  }
}
```

**app.json** configuration:
```json
{
  "expo": {
    "name": "Your App Name",
    "slug": "your-app-slug",
    "version": "1.0.0",
    "android": {
      "package": "com.yourcompany.yourapp",
      "versionCode": 1,
      "permissions": []
    },
    "ios": {
      "bundleIdentifier": "com.yourcompany.yourapp",
      "buildNumber": "1.0.0"
    }
  }
}
```

---

## 🌐 2. NEXT.JS (Frontend Web App)

### Development Build
```bash
# Navigate to Next.js project
cd your-nextjs-app

# Install dependencies
npm install

# Run development server
npm run dev
```

### Production Build

#### Build for Production
```bash
# Create optimized production build
npm run build

# Test production build locally
npm start
```

#### Build Output
```bash
# Your build will be in .next folder
# For static export (if applicable):
npm run build && npm run export
# Output will be in 'out' folder
```

### Deployment Options

#### Option A: Vercel (Recommended for Next.js)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

#### Option B: Docker
Create **Dockerfile**:
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t healthcare-nextjs .
docker run -p 3000:3000 healthcare-nextjs
```

#### Option C: Traditional Server (PM2)
```bash
# Install PM2
npm install -g pm2

# Build
npm run build

# Start with PM2
pm2 start npm --name "nextjs-app" -- start

# Save PM2 configuration
pm2 save
pm2 startup
```

### Environment Variables
Create **.env.production**:
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## 🔧 3. EXPRESS.JS (Backend API)

### Development Setup
```bash
# Navigate to Express project
cd your-express-api

# Install dependencies
npm install

# Run development server
npm run dev
# or
node server.js
```

### Production Build

#### Prepare for Production

**package.json** scripts:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "build": "echo 'No build step required for Express'"
  }
}
```

#### Option A: Docker (Recommended)
Create **Dockerfile**:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "server.js"]
```

Create **.dockerignore**:
```
node_modules
npm-debug.log
.git
.env
```

Build and run:
```bash
docker build -t healthcare-api .
docker run -p 5000:5000 --env-file .env.production healthcare-api
```

#### Option B: PM2 Process Manager
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server.js --name "healthcare-api"

# With environment variables
pm2 start server.js --name "healthcare-api" --env production

# Monitor
pm2 monit

# Save and auto-restart on reboot
pm2 save
pm2 startup
```

**ecosystem.config.js** for PM2:
```javascript
module.exports = {
  apps: [{
    name: 'healthcare-api',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
};

// Start with: pm2 start ecosystem.config.js --env production
```

#### Option C: Traditional Server
```bash
# Install dependencies
npm ci --only=production

# Run with node
NODE_ENV=production node server.js

# Or use a process manager like systemd
```

### Environment Variables
Create **.env.production**:
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://your-production-db
JWT_SECRET=your-secure-secret
CORS_ORIGIN=https://yourdomain.com
```

---

## 🚀 4. COMPLETE DEPLOYMENT WORKFLOW

### Full Stack Docker Compose
Create **docker-compose.yml**:
```yaml
version: '3.8'

services:
  # MongoDB
  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password

  # Express API
  api:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongodb:27017/healthcare
    depends_on:
      - mongodb

  # Next.js Frontend
  web:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://api:5000
    depends_on:
      - api

volumes:
  mongodb_data:
```

Run everything:
```bash
docker-compose up -d
```

---

## 📦 5. BUILD CHECKLIST

### Before Building

- [ ] Update version numbers in package.json
- [ ] Set correct API URLs in environment variables
- [ ] Remove console.logs and debug code
- [ ] Run linting: `npm run lint`
- [ ] Run tests: `npm test`
- [ ] Update dependencies: `npm audit fix`
- [ ] Check .gitignore includes build artifacts
- [ ] Verify environment variables are set correctly

### Security Checklist

- [ ] Use environment variables for secrets
- [ ] Enable CORS with specific origins
- [ ] Use HTTPS in production
- [ ] Implement rate limiting
- [ ] Add security headers
- [ ] Validate all inputs
- [ ] Use secure cookie settings
- [ ] Keep dependencies updated

---

## 🔄 6. CI/CD PIPELINE EXAMPLE

**GitHub Actions** (.github/workflows/deploy.yml):
```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build-nextjs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: cd frontend && npm ci
      - run: cd frontend && npm run build
      
  build-express:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: cd backend && npm ci
      
  build-expo:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: cd mobile && npm ci
      - run: cd mobile && eas build --platform android --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

---

## 📱 7. MOBILE APP DISTRIBUTION

### Android
1. Build APK/AAB with EAS or local build
2. Upload to Google Play Console
3. Or distribute APK directly for testing

### iOS
1. Build with EAS (requires Apple Developer Account)
2. Upload to App Store Connect
3. TestFlight for beta testing

### Over-the-Air (OTA) Updates
```bash
# Install expo-updates
npx expo install expo-updates

# Publish update
eas update --branch production --message "Bug fixes"
```

---

## 🌍 8. HOSTING RECOMMENDATIONS

### Next.js Frontend
- **Vercel** (Best for Next.js, zero config)
- **Netlify** (Easy deployment)
- **AWS Amplify**
- **Digital Ocean App Platform**

### Express.js Backend
- **Railway** (Easy Node.js hosting)
- **Render** (Free tier available)
- **Heroku** (Classic choice)
- **AWS EC2 / Elastic Beanstalk**
- **Digital Ocean Droplets**

### Database
- **MongoDB Atlas** (Managed MongoDB)
- **AWS DocumentDB**
- **Self-hosted on VPS**

### Mobile Apps
- **Google Play Store** (Android)
- **Apple App Store** (iOS)
- **Expo Updates** (OTA updates)

---

## 🛠️ 9. PRODUCTION MONITORING

### Install Monitoring Tools
```bash
# Backend monitoring
npm install morgan winston

# Performance monitoring
npm install newrelic @sentry/node

# Health checks
npm install express-healthcheck
```

### Basic Health Check Endpoint
```javascript
// In your Express app
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

---

## 📝 Quick Reference Commands

```bash
# EXPO
eas build --platform android --profile production
eas submit --platform android

# NEXT.JS
npm run build && npm start
vercel --prod

# EXPRESS
pm2 start server.js --name api
pm2 logs api

# DOCKER
docker-compose up -d
docker-compose logs -f

# Check builds
docker ps
pm2 list
```

---

## 🆘 Common Issues

**Expo build fails:**
- Check app.json configuration
- Verify EAS CLI is logged in
- Check expo version compatibility

**Next.js build errors:**
- Clear .next folder: `rm -rf .next`
- Check environment variables
- Verify API endpoints are correct

**Express connection issues:**
- Check MongoDB connection string
- Verify CORS settings
- Check firewall rules

---

## 📚 Additional Resources

- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)