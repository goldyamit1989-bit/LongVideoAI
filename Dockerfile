FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
COPY media ./media
ENV NODE_ENV=production
EXPOSE 8080
CMD ["npm","start"]
