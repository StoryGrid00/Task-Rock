# 📝 Changelog - Task Rock

## [1.2.0] - 2025-07-10 - Push Notification Fix

### 🔧 Fixed
- **CRITICAL**: Fixed Firebase API key placeholder that prevented initialization
- **CRITICAL**: Fixed push notifications appearing as audio files instead of text
- **CRITICAL**: Removed complex notification options causing rich media interpretation
- **CRITICAL**: Simplified service worker notifications for proper text display
- **CRITICAL**: Standardized notification content across all scenarios

### 🎯 Improved
- **Notification Content**: All notifications now show "Task Rock" / "You have task(s) to complete :)"
- **Reliability**: Simplified notification payload for better cross-platform compatibility
- **Performance**: Removed unnecessary notification options reducing payload size
- **User Experience**: Consistent notification format across foreground and background

### 🧹 Removed
- Complex notification actions (View Task, Snooze buttons)
- `requireInteraction` option that caused display issues
- Dynamic task-specific notification content
- Vibration patterns and rich media options
- Redundant notification timing strategies

### 📱 Technical Changes
- Updated Firebase configuration to remove placeholder values
- Simplified `sendSingleNotification()` function
- Cleaned up service worker background message handling
- Standardized foreground message notifications
- Removed Firebase Functions integration (not needed for basic notifications)

## [1.1.0] - Previous Version

### ✅ Features
- iOS-style notification toggle in Settings
- Firebase Cloud Messaging integration
- VAPID key configuration
- Notification timing at 20, 15, 10, 5, 2 minutes before due
- Service worker for background notifications
- Token management and persistence

### 🎮 Game Features
- Jerry the Rock virtual companion
- Task creation and management
- Health system based on task completion
- Accessory unlocking system
- Progressive Web App functionality

## [1.0.0] - Initial Release

### 🎯 Core Features
- Task management with due dates and times
- Virtual pet companion (Jerry)
- Local storage for game state
- Responsive design for mobile and desktop
- Basic notification system

---

## 🔄 Migration Notes

### From 1.1.0 to 1.2.0
- **No breaking changes** - existing users will automatically get fixed notifications
- **No data loss** - all tasks and progress preserved
- **Improved experience** - notifications now appear as proper text instead of audio files

### Deployment
- Simply replace existing files with new versions
- No database migrations required
- No user action needed

---

## 🐛 Known Issues

### Resolved in 1.2.0
- ✅ Notifications appearing as audio files with play buttons
- ✅ Firebase initialization failing due to placeholder API key
- ✅ Inconsistent notification content between foreground/background
- ✅ Complex notification options causing display issues

### Still Open
- None currently known

---

## 🚀 Upcoming Features

### Planned for 1.3.0
- Enhanced Jerry animations
- More customization options
- Task categories and tags
- Export/import functionality
- Dark mode theme

### Under Consideration
- Multi-language support
- Cloud sync across devices
- Team/shared task lists
- Advanced notification scheduling

---

**For technical support or feature requests, please open an issue on GitHub.**

