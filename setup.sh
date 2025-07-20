#!/bin/bash

# Task Rock - Local Notifications Setup Script
# This script helps deploy the local notification system

echo "🗿 Task Rock - Local Notifications Setup"
echo "========================================"

# Check if we're in the right directory
if [ ! -f "index-local-notifications.html" ]; then
    echo "❌ Error: Please run this script from the task-rock-local-notifications-package directory"
    exit 1
fi

echo "📁 Setting up local notification system..."

# Backup original index.html if it exists
if [ -f "index.html" ]; then
    echo "📋 Backing up original index.html to index-firebase-backup.html"
    mv index.html index-firebase-backup.html
fi

# Use the local notifications version as main
echo "🔄 Setting up local notifications as main version"
cp index-local-notifications.html index.html

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Upload all files to your web server"
echo "2. Ensure your site uses HTTPS"
echo "3. Test by creating a task with due date"
echo ""
echo "📖 For detailed instructions, see:"
echo "   - Task-Rock-Local-Notifications-README.md"
echo "   - DEPLOYMENT-GUIDE.md"
echo ""
echo "🎉 Ready to rock with reliable notifications!"

