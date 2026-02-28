# vLLM Dockerfile for FunctionGemma GGUF deployment on Railway
FROM vllm/vllm-openai:latest

# Set environment variables
ENV MODEL_NAME="Keshav069/functiongemma_finetune_tak"
ENV QUANTIZATION="gguf"
ENV GGUF_FILE="functiongemma-270m-it.BF16.gguf"
ENV PORT=8080
ENV CUDA_VISIBLE_DEVICES=""

# Expose port
EXPOSE 8080

# Start vLLM server with GGUF model in CPU mode
CMD python3 -m vllm.entrypoints.openai.api_server \
    --model $MODEL_NAME \
    --quantization $QUANTIZATION \
    --gguf-file $GGUF_FILE \
    --device cpu \
    --host 0.0.0.0 \
    --port $PORT \
    --trust-remote-code \
    --max-model-len 2048 \
    --dtype bfloat16
