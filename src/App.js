import { useState } from "react";
import { Menu, Plus, MessageSquare, Settings, User, Send, Bot, X } from "lucide-react";

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Default closed on mobile

  // OpenRouter Configuration
  const [apiKey, setApiKey] = useState(
    "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"
  );
  const [selectedModel, setSelectedModel] = useState(
    "anthropic/claude-3-haiku"
  );
  const [customInstructions, setCustomInstructions] = useState(
    "You are a helpful AI assistant working on a Zapier blog project. Provide clear, concise, and actionable advice about automation, workflows, and productivity."
  );
  const [lastRequestTime, setLastRequestTime] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const [rateLimitInfo, setRateLimitInfo] = useState(null);

  const availableModels = [
    { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku" },
    { id: "anthropic/claude-3-sonnet", name: "Claude 3 Sonnet" },
    { id: "openai/gpt-4", name: "GPT-4" },
    { id: "openai/gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
    { id: "meta-llama/llama-3-70b-instruct", name: "Llama 3 70B" },
    { id: "google/gemini-pro", name: "Gemini Pro" },
  ];

  const handleSend = async () => {
    if (input.trim() === "" || !apiKey) return;

    // Rate limiting check - minimum 2 seconds between requests
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < 2000) {
      const waitTime = 2000 - timeSinceLastRequest;
      const errorMessage = {
        text: `Please wait ${Math.ceil(waitTime / 1000)} seconds before sending another message.`,
        type: "error",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    const userMessage = { text: input, type: "user", timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setLastRequestTime(now);
    setRequestCount(prev => prev + 1);

    const currentInput = input;
    setInput("");

    try {
      // Prepare messages for OpenRouter API
      const systemMessage = customInstructions
        ? { role: "system", content: customInstructions }
        : {
          role: "system",
          content:
            "You are a helpful assistant working on a Zapier blog project.",
        };

      const conversationMessages = [
        systemMessage,
        ...messages.map((msg) => ({
          role: msg.type === "user" ? "user" : "assistant",
          content: msg.text,
        })),
        { role: "user", content: currentInput },
      ];

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "X-Title": "Zapier Blog Chat",
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: conversationMessages,
            temperature: 0.7,
            max_tokens: 1500, // Reduced to help with rate limits
          }),
        }
      );

      // Extract rate limit info from headers
      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
      const rateLimitReset = response.headers.get('x-ratelimit-reset');

      if (rateLimitRemaining) {
        setRateLimitInfo({
          remaining: rateLimitRemaining,
          reset: rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000) : null
        });
      }

      if (!response.ok) {
        if (response.status === 429) {
          const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000) : null;
          const waitMinutes = resetTime ? Math.ceil((resetTime - new Date()) / 60000) : 5;
          throw new Error(`Rate limit exceeded. Please wait ${waitMinutes} minutes before trying again.`);
        } else if (response.status === 401) {
          throw new Error('Invalid API key. Please check your OpenRouter API key.');
        } else if (response.status === 402) {
          throw new Error('Insufficient credits. Please check your OpenRouter account balance.');
        } else {
          throw new Error(`API error (${response.status}): ${response.statusText}`);
        }
      }

      const data = await response.json();

      if (data.choices && data.choices[0] && data.choices[0].message) {
        const botResponse = {
          text: data.choices[0].message.content,
          type: "bot",
          timestamp: new Date(),
          model: selectedModel,
        };
        setMessages((prev) => [...prev, botResponse]);
      } else {
        throw new Error("Invalid response format from API");
      }
    } catch (error) {
      console.error("Error calling OpenRouter API:", error);
      const errorMessage = {
        text: `Error: ${error.message}`,
        type: "error",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    setRequestCount(0);
    setRateLimitInfo(null);
    setSidebarOpen(false); // Close sidebar after new chat on mobile
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 relative">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed lg:relative lg:translate-x-0 w-80 lg:w-64 h-full transition-transform duration-300 bg-gray-900 text-white flex flex-col z-50`}>
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4 lg:mb-0">
            <h2 className="text-lg font-semibold lg:hidden">Chat Settings</h2>
            <button
              onClick={closeSidebar}
              className="p-2 hover:bg-gray-800 rounded-lg lg:hidden"
            >
              <X size={20} />
            </button>
          </div>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-2 w-full p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Plus size={16} />
            <span>New Chat</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">API Configuration</h3>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your OpenRouter API key"
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded text-sm text-white mb-3"
              />
              <button
                onClick={() => {
                  // Test API key
                  if (apiKey.startsWith('sk-or-v1-')) {
                    const testMessage = {
                      text: "API key format appears correct ✓",
                      type: "bot",
                      timestamp: new Date(),
                    };
                    setMessages(prev => [...prev, testMessage]);
                  } else {
                    const errorMessage = {
                      text: "⚠️ OpenRouter API keys should start with 'sk-or-v1-'",
                      type: "error",
                      timestamp: new Date(),
                    };
                    setMessages(prev => [...prev, errorMessage]);
                  }
                  setSidebarOpen(false);
                }}
                className="w-full p-3 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white"
              >
                Test API Key Format
              </button>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Model Settings</h3>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded text-sm text-white"
              >
                {availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Chats</h3>
              {messages.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-gray-800 rounded-lg">
                  <MessageSquare size={16} />
                  <span className="text-sm truncate">
                    {messages.find(m => m.type === 'user')?.text?.slice(0, 30) || 'New conversation'}...
                  </span>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Instructions</h3>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded text-sm text-white resize-none"
                rows={4}
                placeholder="Enter custom instructions..."
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-700">
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              <Settings size={16} />
              <span className="text-sm">Settings</span>
            </div>
            <div className="flex items-center gap-2 p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              <User size={16} />
              <span className="text-sm">Profile</span>
            </div>
            <div className="text-xs text-gray-500 pt-2">
              <div className="mb-1">Model: {availableModels.find(m => m.id === selectedModel)?.name}</div>
              <div>Requests: {requestCount}</div>
              {rateLimitInfo && (
                <div className="mt-2 space-y-1">
                  <div>Remaining: {rateLimitInfo.remaining}</div>
                  {rateLimitInfo.reset && (
                    <div>Reset: {rateLimitInfo.reset.toLocaleTimeString()}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-xl font-semibold text-gray-800 truncate">Chat AI</h1>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center p-4">
              <div className="text-center">
                <Bot size={48} className="mx-auto mb-4 text-gray-400" />
                <h2 className="text-xl lg:text-2xl font-semibold text-gray-800 mb-2">How can I help you today?</h2>
                <p className="text-gray-600">Ask me anything and I'll do my best to help</p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-4 lg:py-8 px-4">
              {messages.map((message, index) => (
                <div key={index} className={`mb-6 lg:mb-8 ${message.type === 'user' ? 'ml-auto' : ''}`}>
                  <div className="flex items-start gap-2 lg:gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.type === 'user'
                      ? 'bg-blue-500 text-white order-2'
                      : message.type === 'error'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-700 text-white'
                      }`}>
                      {message.type === 'user' ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    <div className={`flex-1 min-w-0 ${message.type === 'user' ? 'order-1' : ''}`}>
                      <div className={`p-3 lg:p-4 rounded-lg ${message.type === 'user'
                        ? 'bg-blue-500 text-white ml-auto max-w-xs lg:max-w-md'
                        : message.type === 'error'
                          ? 'bg-red-50 border border-red-200 text-red-800'
                          : 'bg-white border border-gray-200'
                        }`}>
                        <p className="whitespace-pre-wrap text-sm lg:text-base break-words">{message.text}</p>
                        {message.model && message.type === 'bot' && (
                          <div className="text-xs text-gray-500 mt-2">
                            {availableModels.find(m => m.id === message.model)?.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="mb-6 lg:mb-8">
                  <div className="flex items-start gap-2 lg:gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 text-white flex items-center justify-center flex-shrink-0">
                      <Bot size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="p-3 lg:p-4 bg-white border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="animate-pulse text-sm lg:text-base">Thinking...</div>
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-4 safe-area-bottom">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 lg:gap-3">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message Chat AI..."
                  className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm lg:text-base"
                  rows={1}
                  disabled={isLoading}
                  style={{ minHeight: '48px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="absolute right-2 bottom-2 p-2 text-gray-500 hover:text-blue-500 disabled:text-gray-300 disabled:cursor-not-allowed"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2 text-center">
              <div>Press Enter to send, Shift+Enter for new line</div>
              {rateLimitInfo && rateLimitInfo.remaining && parseInt(rateLimitInfo.remaining) < 5 && (
                <div className="text-orange-500 mt-1">
                  ⚠️ Rate limit warning: {rateLimitInfo.remaining} requests remaining
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;