FROM rstiupm/irac_p2:2025

WORKDIR /home/irac

COPY . .

RUN npm install --omit=dev

EXPOSE 8080

CMD ["node", "optional/completeNodeServerWithDataChannel_http.js"]
