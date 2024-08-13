#Specify a base image
FROM node:alpine

#install dependencies
COPY package*.json /music-bot
RUN apk update
RUN apk add
RUN apk add ffmpeg

#Copy the project
COPY ./ ./

#Install dependencies
RUN npm install 
#RUN npm i ffmpeg-static

#Default command
CMD ["npm","start"]