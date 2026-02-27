#!/usr/bin/env bash

# Projectarium PWA Deployment Script

ECR_REPO="083365649555.dkr.ecr.us-east-1.amazonaws.com/projectarium/pwa"
REMOTE="projectarium-pwa"

# Dependency check
command -v docker &> /dev/null || { echo "❌ Docker not found. Install: https://docs.docker.com/get-docker/"; exit 1; }
command -v aws &> /dev/null || { echo "❌ AWS CLI not found. Install: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"; exit 1; }

# Build container
echo "🐳 Building Docker container..."
docker buildx build --platform linux/arm64 -t projectarium/pwa:latest --load .

# Login to ECR
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 083365649555.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
echo "📤 Pushing to ECR..."
docker tag projectarium/pwa:latest $ECR_REPO:latest
docker push $ECR_REPO:latest

# Check if AWS CLI is installed on remote
echo "🔍 Checking remote setup..."
if ! ssh "$REMOTE" "command -v aws &> /dev/null"; then
    echo "⚙️  Installing AWS CLI on remote..."
    ssh "$REMOTE" "sudo apt update && sudo apt install -y unzip && curl -s 'https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip' -o awscliv2.zip && unzip -q awscliv2.zip && sudo ./aws/install && rm -rf aws awscliv2.zip"
    echo "✅ AWS CLI installed on remote"
fi

# Deploy to remote
echo "🚀 Deploying to $REMOTE..."
ssh "$REMOTE" "aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REPO"
ssh "$REMOTE" "docker pull $ECR_REPO:latest"
ssh "$REMOTE" "docker stop projectarium-pwa 2>/dev/null; docker rm projectarium-pwa 2>/dev/null; true"
ssh "$REMOTE" "docker run -d --name projectarium-pwa -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://your-api:8888/api --restart unless-stopped $ECR_REPO:latest"
EOF

echo ""
echo "✅ Done! Running on $REMOTE:3000"
echo ""