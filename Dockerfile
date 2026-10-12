FROM node:22-bookworm-slim

WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/insurancerp.db
ENV AUTH_SECRET=change-me-before-the-trial
ENV AUTH_COOKIE_SECURE=false
ENV UPLOAD_DIR=/data/uploads

EXPOSE 3000
CMD ["sh", "docker/entrypoint.sh"]
