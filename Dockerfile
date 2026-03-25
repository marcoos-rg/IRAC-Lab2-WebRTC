FROM rstiupm/irac_p2:2025

COPY . /home/irac

WORKDIR /home/irac

RUN npm install --omit=dev

EXPOSE 8080

CMD ["node", "cap5/completeNodeServerWithDataChannel.js"]
