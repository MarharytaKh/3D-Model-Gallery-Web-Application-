FROM nginx:alpine

RUN apk add --no-cache openssh fail2ban iptables bash

RUN mkdir /var/run/sshd \
 && ssh-keygen -A \
 && touch /var/log/auth.log

COPY nginx.conf /etc/nginx/nginx.conf
COPY sshd_config /etc/ssh/sshd_config
COPY jail.local /etc/fail2ban/jail.local
COPY iptables.sh /iptables.sh
COPY check-status.sh /check-status.sh

RUN sed -i 's/\r$//' /check-status.sh \
 && chmod +x /iptables.sh /check-status.sh


RUN adduser -D -s /bin/sh -g "" nginxuser \
 && sed -i 's/^nginxuser:!/nginxuser:/' /etc/shadow
RUN mkdir -p /home/nginxuser/.ssh
COPY authorized_keys /home/nginxuser/.ssh/authorized_keys

RUN chown -R nginxuser:nginxuser /home/nginxuser/.ssh \
 && chmod 700 /home/nginxuser \
 && chmod 700 /home/nginxuser/.ssh \
 && chmod 600 /home/nginxuser/.ssh/authorized_keys

EXPOSE 80 22

CMD ["sh", "-c", "\
mkdir -p /var/run/fail2ban && \
fail2ban-server -b && \
/usr/sbin/sshd && \
nginx -g 'daemon off;'"]



















