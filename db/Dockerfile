FROM postgres:15-alpine

COPY check-status.sh /check-status.sh
RUN sed -i 's/\r$//' /check-status.sh \
 && chmod +x /check-status.sh
