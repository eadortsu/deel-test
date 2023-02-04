## build image
FROM node:18.14.0-alpine

WORKDIR /workspace
COPY package.json /workspace/
COPY package-lock.json /workspace/
RUN npm install
COPY . .

EXPOSE 3001
ENV NODE_ENV production
CMD ["node", "/src/server.js"]

