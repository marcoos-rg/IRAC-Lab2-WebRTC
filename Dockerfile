FROM rstiupm/irac_p2:2025

WORKDIR /home/irac

EXPOSE 8080

# Instala dependencias si no existen (cubre el caso del volume mount)
ENTRYPOINT ["sh", "-c", "[ ! -d node_modules ] && npm init --yes && npm install socket.io node-static --omit=dev; exec \"$@\"", "--"]

CMD ["node", "optional/completeNodeServerWithDataChannel.js"]
