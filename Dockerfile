## build image
FROM node:16.14.2-alpine

WORKDIR /workspace
COPY package.json /workspace/
COPY yarn.lock /workspace/
RUN yarn install
COPY . .
RUN yarn build

EXPOSE 3000
ENV NODE_ENV production
CMD ["npm", "run", "start:prod"]
