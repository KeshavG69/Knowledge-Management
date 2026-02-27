"""
MLX Inference for FunctionGemma - OpenAI Function Format
Uses OpenAI-style function calling format

Usage:
    uv run python scripts/mlx_inference_functiongemma_v3.py
"""

from mlx_lm import load, generate
from mlx_lm.sample_utils import make_sampler

MODEL_ID = "Keshav069/functiongemma_finetune_tak"

# Tool definitions in OpenAI function calling format
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": "Search the knowledge base using semantic search. Use this tool to find information from uploaded documents, PDFs, videos, and images.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query to find relevant documents"},
                    "num_documents": {"type": "integer", "description": "Maximum number of results to return", "default": 10}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "place_tak_marker",
            "description": "Place a marker on the TAK network at specified coordinates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "latitude": {"type": "number", "description": "Latitude coordinate (-90 to 90)"},
                    "longitude": {"type": "number", "description": "Longitude coordinate (-180 to 180)"},
                    "callsign": {"type": "string", "description": "Display name/label for the marker"},
                    "message": {"type": "string", "description": "Optional message to attach"}
                },
                "required": ["latitude", "longitude", "callsign"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "send_tak_message",
            "description": "Send a chat message to the TAK network (broadcast to all users).",
            "parameters": {
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "Message text to send"}
                },
                "required": ["message"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_tak_route",
            "description": "Create a route on the TAK network with multiple waypoints.",
            "parameters": {
                "type": "object",
                "properties": {
                    "waypoints": {
                        "type": "array",
                        "description": "List of waypoint dicts with 'lat' and 'lon' keys",
                        "items": {"type": "object"},
                        "minItems": 2
                    },
                    "route_name": {"type": "string", "description": "Display name for the route"}
                },
                "required": ["waypoints", "route_name"]
            }
        }
    }
]


def main():
    print("=" * 80)
    print("🚀 FunctionGemma MLX Inference (OpenAI Format)")
    print("=" * 80)
    print(f"\n📦 Loading model: {MODEL_ID}\n")

    # Load model
    model, tokenizer = load(MODEL_ID)
    print("✅ Model loaded!\n")

    # Create sampler - very low temperature to reduce repetition
    sampler = make_sampler(temp=0.1, top_p=0.9)

    # Test queries
    test_queries = [
        "Hello!",
        "Find information about convoy operations",
        "Place a marker at coordinates 34.5N, 118.2W and call it Checkpoint Alpha",
    ]

    for i, query in enumerate(test_queries, 1):
        print(f"\n{'='*80}")
        print(f"[Test {i}] {query}")
        print("=" * 80)

        # Format messages
        messages = [
            {"role": "user", "content": query}
        ]

        # Apply chat template with tools
        try:
            prompt = tokenizer.apply_chat_template(
                messages,
                tools=TOOLS,
                tokenize=False,
                add_generation_prompt=True
            )

            print(f"\n📝 Prompt (first 400 chars):")
            print(prompt[:400] + "...\n")

        except Exception as e:
            print(f"❌ Template error: {e}")
            import traceback
            traceback.print_exc()
            continue

        # Generate
        try:
            # Generate with strict limits to prevent repetition
            response = generate(
                model,
                tokenizer,
                prompt=prompt,
                sampler=sampler,
                max_tokens=128,  # Shorter to stop sooner
                verbose=False
            )

            # Stop at first end tag to avoid repetition
            if '<end_function_call>' in response:
                # Find first complete function call
                end_idx = response.find('<end_function_call>') + len('<end_function_call>')
                response = response[:end_idx]

            print(f"🤖 Response:")
            print(response)

        except Exception as e:
            print(f"❌ Generation error: {e}")

    print(f"\n{'='*80}")
    print("✅ Tests complete!")
    print("=" * 80)


if __name__ == "__main__":
    main()
