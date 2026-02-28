# FunctionGemma vLLM Deployment on Railway

This folder contains everything needed to deploy the finetuned FunctionGemma model on Railway using vLLM with GGUF quantization.

## Model Details

- **Model**: Keshav069/functiongemma_finetune_tak
- **Base Model**: Google Gemma 3 (270M parameters)
- **Format**: GGUF (BF16 quantization)
- **GGUF File**: functiongemma-270m-it.BF16.gguf (~540MB)
- **Inference Engine**: vLLM with OpenAI-compatible API

## Files

- `Dockerfile` - vLLM Docker configuration
- `railway.json` - Railway deployment configuration
- `README.md` - This file

## Deployment Steps

### 1. Prerequisites

- Railway account ([railway.app](https://railway.app))
- Railway CLI installed (optional): `npm i -g @railway/cli`

### 2. Deploy via Railway Web UI

1. Go to [railway.app](https://railway.app) and create a new project
2. Click "Deploy from GitHub repo" or "Empty Project"
3. Connect this folder or upload the files
4. Railway will automatically detect the Dockerfile and deploy

### 3. Deploy via Railway CLI

```bash
# Login to Railway
railway login

# Initialize project (from this directory)
cd deploy-railway
railway init

# Deploy
railway up
```

### 4. Environment Variables

The following environment variables are pre-configured in the Dockerfile:

- `MODEL_NAME`: Keshav069/functiongemma_finetune_tak
- `QUANTIZATION`: gguf
- `GGUF_FILE`: functiongemma-270m-it.BF16.gguf
- `PORT`: 8080

You can override these in Railway's dashboard if needed.

### 5. Access the API

Once deployed, Railway will provide a public URL. The vLLM server exposes an OpenAI-compatible API at:

```
https://your-railway-url.railway.app/v1/chat/completions
```

## API Usage

### Example Request (cURL)

```bash
curl https://your-railway-url.railway.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Keshav069/functiongemma_finetune_tak",
    "messages": [
      {"role": "user", "content": "Place a marker at 34.5N, 118.2W called Checkpoint Alpha"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "place_tak_marker",
          "description": "Place a marker on the TAK network",
          "parameters": {
            "type": "object",
            "properties": {
              "latitude": {"type": "number"},
              "longitude": {"type": "number"},
              "callsign": {"type": "string"}
            },
            "required": ["latitude", "longitude", "callsign"]
          }
        }
      }
    ],
    "temperature": 0.1,
    "max_tokens": 128
  }'
```

### Example Request (Python)

```python
import requests

url = "https://your-railway-url.railway.app/v1/chat/completions"

response = requests.post(url, json={
    "model": "Keshav069/functiongemma_finetune_tak",
    "messages": [
        {"role": "user", "content": "Find information about convoy operations"}
    ],
    "tools": [
        {
            "type": "function",
            "function": {
                "name": "search_knowledge_base",
                "description": "Search the knowledge base",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                        "num_documents": {"type": "integer", "default": 10}
                    },
                    "required": ["query"]
                }
            }
        }
    ],
    "temperature": 0.1,
    "max_tokens": 128
})

print(response.json())
```

## Available Tools

The model is finetuned on 4 custom tools:

1. **search_knowledge_base** - Search uploaded documents/PDFs/videos
2. **place_tak_marker** - Place markers on TAK network
3. **send_tak_message** - Send chat messages to TAK network
4. **create_tak_route** - Create routes with waypoints on TAK

## FunctionGemma Output Format

The model outputs function calls in this format:

```
call:place_tak_marker{latitude:<escape>34.5<escape>,longitude:<escape>-118.2<escape>,callsign:<escape>Checkpoint Alpha<escape>}
```

Note the `<escape>` tags around string/number values. This is FunctionGemma's special token format.

## Configuration Details

### vLLM Parameters

- `--max-model-len 2048` - Maximum context length
- `--dtype bfloat16` - Data type for inference
- `--trust-remote-code` - Required for Gemma models
- `--quantization gguf` - Use GGUF quantization
- `--gguf-file` - Specify GGUF file from model repo

### Recommended Settings

- **Temperature**: 0.1 (lower reduces repetition)
- **Max Tokens**: 128 (enough for function calls)
- **Top P**: 0.9

## Troubleshooting

### Model Download Issues

If the model fails to download, ensure Railway has internet access. The model will be downloaded from HuggingFace on first startup (~540MB).

### Memory Issues

The GGUF BF16 quantized model requires ~1GB RAM. Railway's free tier should handle this, but upgrade if needed.

### Port Issues

Railway automatically assigns the PORT environment variable. The Dockerfile uses PORT=8080 by default, which Railway will map correctly.

## Performance

- **Model Size**: 270M parameters (~540MB GGUF)
- **Inference Speed**: ~50-100 tokens/sec on Railway (CPU)
- **Cold Start**: ~30-60 seconds (model download + load)

## Support

For issues with:
- **vLLM**: [github.com/vllm-project/vllm](https://github.com/vllm-project/vllm)
- **Railway**: [docs.railway.app](https://docs.railway.app)
- **Model**: Check HuggingFace model card at [Keshav069/functiongemma_finetune_tak](https://huggingface.co/Keshav069/functiongemma_finetune_tak)
