FROM node:22
WORKDIR /home/node/app
COPY package*.json ./
RUN npm install
COPY . .
RUN chown -R node:node /home/node/app
RUN chmod -R u+rw /home/node/app/client/public
USER node
EXPOSE 3000
CMD ["make", "start"]