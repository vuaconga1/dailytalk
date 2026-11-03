FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 HOST=0.0.0.0 PORT=8000 DATA_DIR=/data
WORKDIR /app
RUN pip install --no-cache-dir tzdata && useradd --system --uid 1000 wewin && mkdir -p /data && chown wewin /data
COPY --chown=wewin . .
USER wewin
VOLUME /data
EXPOSE 8000
CMD ["python", "server.py"]
