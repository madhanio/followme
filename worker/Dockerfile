# Use lightweight node base image
FROM node:20-alpine

WORKDIR /app

# Copy dependency configs
COPY package*.json tsconfig.json ./

# Install dependecies
RUN npm ci

# Copy source code
COPY src/ ./src/

# Compile TypeScript
RUN npm run build

# Prune development dependencies
RUN npm prune --production

ENV NODE_ENV=production
EXPOSE 8000

# Start application
CMD ["node", "dist/index.js"]
