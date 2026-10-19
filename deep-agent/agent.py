"""
Deep Agent Quickstart
Demonstrates building an autonomous research agent using the deepagents framework.
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Reconfigure stdout for Windows console compatibility safely
if hasattr(sys.stdout, "reconfigure"):
    getattr(sys.stdout, "reconfigure")(encoding='utf-8')

# Load environment
env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

from deepagents import create_deep_agent
from langchain_openai import ChatOpenAI

def run_agent():
    print("==================================================")
    print("      DEEP AGENTS PYTHON QUICKSTART AGENT         ")
    print("==================================================")

    api_key = os.getenv("OPENROUTER_API_KEY", "")
    base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    
    # Priority list of free models with automated failover
    candidate_models = [
        os.getenv("CONVERSATION_MODEL", "nvidia/nemotron-3.5-super-vl:free"),
        "liquid/lfm-2.5-2.6b:free",
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    ]

    query = "What are the core stages in canine allergic dermatitis management?"
    last_err = None

    for model_name in candidate_models:
        try:
            print(f"\nInitializing Deep Agent with model: {model_name}...")
            model = ChatOpenAI(
                model=model_name,
                openai_api_key=api_key,
                openai_api_base=base_url,
                temperature=0.2,
                default_headers={
                    "HTTP-Referer": "http://localhost:5173",
                    "X-Title": "VetBot Deep Agent",
                }
            )

            agent = create_deep_agent(
                model=model,
                system_prompt=(
                    "You are an autonomous veterinary research agent. "
                    "You provide evidence-grounded summaries on pet health, "
                    "nutrition, and veterinary triage best practices."
                )
            )

            print(f"Invoking agent with query:\n'{query}'\n")

            result = agent.invoke({
                "messages": [
                    {"role": "user", "content": query}
                ]
            })

            print("--- Agent Response ---")
            messages = result.get("messages", [])
            if messages:
                last_msg = messages[-1]
                content = getattr(last_msg, "content", str(last_msg))
                print(content[:800] + ("..." if len(content) > 800 else ""))
            else:
                print("Result:", result)
            print("----------------------")
            return
        except Exception as e:
            err_str = str(e)
            print(f"⚠️ Model {model_name} encountered an issue: {err_str[:120]}")
            if "ResourceExhausted" in err_str or "502" in err_str or "overloaded" in err_str or "429" in err_str:
                print("🔄 Model is temporarily overloaded. Switching to next candidate model...")
                last_err = e
                continue
            last_err = e

    if last_err:
        print(f"\n❌ All candidate models were unavailable: {last_err}")

if __name__ == "__main__":
    run_agent()
