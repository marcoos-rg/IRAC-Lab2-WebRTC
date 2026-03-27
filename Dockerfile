FROM rstiupm/irac_p2:2025

# Create app directory
WORKDIR /home/irac

# Copy package.json and package-lock.json (if it exists)
COPY package*.json ./

# Install dependencies defined in package.json
RUN npm install

# Bundle app source
COPY . .

# Render will use the PORT environment variable
# If you want to use a specific port, you can set it in render.yaml

CMD ["node", "optional/completeNodeServerWithDataChannel.js"]
