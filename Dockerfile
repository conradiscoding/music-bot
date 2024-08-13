#Specify a base image
FROM node:alpine

#Copy the project
COPY ./ ./

#Install dependencies
RUN npm install 

#Default command
CMD ["npm","start"]