# vLLM CPU Dockerfile for FunctionGemma GGUF deployment on Railway
FROM public.ecr.aws/q9t5s3a7/vllm-cpu-release-repo:latest

# Set environment variables
ENV MODEL_NAME="Keshav069/functiongemma_finetune_tak"
ENV QUANTIZATION="gguf"
ENV GGUF_FILE="functiongemma-270m-it.BF16.gguf"
ENV PORT=8080
ENV VLLM_CPU_KVCACHE_SPACE=4

# Expose port
EXPOSE 8080

# Start vLLM server with GGUF model in CPU mode
CMD ["sh", "-c", "vllm serve ${MODEL_NAME} --quantization ${QUANTIZATION} --gguf-file ${GGUF_FILE} --host 0.0.0.0 --port ${PORT} --trust-remote-code --max-model-len 2048 --dtype bfloat16"]
