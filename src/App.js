import { useState, useEffect, useRef, useCallback } from "react";
import { Menu, Plus, MessageSquare, Settings, User, Send, Bot, X, AlertCircle, Key, Shield, Clock } from "lucide-react";

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);

  // OpenRouter Configuration with your provided API key and model
  const DEFAULT_API_KEY = "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";
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [selectedModel, setSelectedModel] = useState("deepseek/deepseek-r1-0528:free");
  const [customInstructions, setCustomInstructions] = useState(
    "You are a helpful AI assistant. Provide clear, concise, and actionable responses to user queries."
  );

  // Enhanced rate limiting with exponential backoff
  const [rateLimitState, setRateLimitState] = useState({
    requestTimes: [],
    backoffDelay: 1000,
    maxBackoff: 32000,
    requestCount: 0,
    remaining: null,
    resetTime: null
  });

  // API key validation algorithm
  const validateApiKey = useCallback((key) => {
    if (!key || typeof key !== 'string') return { valid: false, type: 'missing' };

    const trimmedKey = key.trim();
    if (trimmedKey.length === 0) return { valid: false, type: 'empty' };

    // OpenRouter API key format validation
    if (trimmedKey.startsWith('sk-or-v1-')) {
      if (trimmedKey.length < 50) return { valid: false, type: 'too_short' };
      return { valid: true, type: 'openrouter' };
    }

    // Check for other common API key formats
    if (trimmedKey.startsWith('sk-')) return { valid: false, type: 'wrong_format' };
    if (trimmedKey.startsWith('Bearer ')) return { valid: false, type: 'bearer_format' };

    return { valid: false, type: 'invalid_format' };
  }, []);

  // Rate limiting algorithm with sliding window
  const checkRateLimit = useCallback(() => {
    const now = Date.now();
    const windowSize = 60000; // 1 minute window
    const maxRequests = 20; // Max 20 requests per minute

    // Clean old requests from sliding window
    const recentRequests = rateLimitState.requestTimes.filter(
      time => now - time < windowSize
    );

    // Check if we're hitting rate limits
    if (recentRequests.length >= maxRequests) {
      const oldestRequest = Math.min(...recentRequests);
      const waitTime = windowSize - (now - oldestRequest);
      return { allowed: false, waitTime };
    }

    // Exponential backoff for consecutive requests
    if (recentRequests.length > 0) {
      const lastRequest = Math.max(...recentRequests);
      const timeSinceLastRequest = now - lastRequest;
      const minDelay = Math.min(rateLimitState.backoffDelay, rateLimitState.maxBackoff);

      if (timeSinceLastRequest < minDelay) {
        return { allowed: false, waitTime: minDelay - timeSinceLastRequest };
      }
    }

    return { allowed: true, waitTime: 0 };
  }, [rateLimitState]);

  // Enhanced error handling algorithm
  const handleApiError = useCallback((response, error) => {
    let errorMessage = "An unexpected error occurred";
    let errorType = "unknown";

    if (response) {
      const status = response.status;
      errorType = `http_${status}`;

      switch (status) {
        case 400:
          errorMessage = "Bad request. Please check your message format.";
          break;
        case 401:
          errorMessage = "Invalid API key. Please verify your OpenRouter API key.";
          errorType = "auth_error";
          break;
        case 402:
          errorMessage = "Insufficient credits. Please check your OpenRouter account balance.";
          errorType = "payment_error";
          break;
        case 403:
          errorMessage = "Access forbidden. Check your API key permissions.";
          break;
        case 429:
          errorMessage = "Rate limit exceeded. Please wait before sending another message.";
          errorType = "rate_limit";
          break;
        case 500:
          errorMessage = "Server error. Please try again in a few moments.";
          break;
        case 502:
        case 503:
        case 504:
          errorMessage = "Service temporarily unavailable. Please try again later.";
          break;
        default:
          errorMessage = `API error (${status}): ${response.statusText}`;
      }
    } else if (error) {
      if (error.name === 'NetworkError' || error.message.includes('fetch')) {
        errorMessage = "Network error. Please check your internet connection.";
        errorType = "network_error";
      } else {
        errorMessage = error.message;
      }
    }

    return { message: errorMessage, type: errorType };
  }, []);

  const availableModels = [
    { id: "deepseek/deepseek-r1-0528:free", name: "DeepSeek R1 (Free)" },
    { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku" },
    { id: "anthropic/claude-3-sonnet", name: "Claude 3 Sonnet" },
    { id: "openai/gpt-4", name: "GPT-4" },
    { id: "openai/gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
    { id: "meta-llama/llama-3-70b-instruct", name: "Llama 3 70B" },
    { id: "google/gemini-pro", name: "Gemini Pro" },
  ];

  // Auto-scroll algorithm with smooth behavior
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({
          behavior: "smooth",
          block: "end",
          inline: "nearest"
        });
      }
    };

    // Delay scroll to ensure DOM is updated
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  // Initialize with default API key
  useEffect(() => {
    const validation = validateApiKey(DEFAULT_API_KEY);
    if (validation.valid) {
      const welcomeMessage = {
        text: "✅ DeepSeek R1 model loaded successfully! You can start chatting right away.",
        type: "bot",
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [validateApiKey]);

  // Enhanced API key change handler
  const handleApiKeyChange = useCallback((newApiKey) => {
    setApiKey(newApiKey);

    const validation = validateApiKey(newApiKey);
    let statusMessage = "";

    if (validation.valid) {
      statusMessage = "✅ API key format is valid";
    } else {
      switch (validation.type) {
        case 'missing':
        case 'empty':
          statusMessage = "⚠️ Please enter an API key";
          break;
        case 'too_short':
          statusMessage = "⚠️ API key appears to be too short";
          break;
        case 'wrong_format':
          statusMessage = "⚠️ This appears to be a different API service key";
          break;
        case 'bearer_format':
          statusMessage = "⚠️ Remove 'Bearer ' prefix from your API key";
          break;
        default:
          statusMessage = "⚠️ OpenRouter API keys should start with 'sk-or-v1-'";
      }
    }

    // Update UI with validation status
    const statusMsg = {
      text: statusMessage,
      type: validation.valid ? "bot" : "error",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, statusMsg]);
  }, [validateApiKey]);

  const handleSend = async () => {
    if (input.trim() === "") return;

    // Validate API key before sending
    const validation = validateApiKey(apiKey);
    if (!validation.valid) {
      const errorMessage = {
        text: "Please enter a valid OpenRouter API key in the sidebar to start chatting.",
        type: "error",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setSidebarOpen(true);
      return;
    }

    // Check rate limiting
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      const waitSeconds = Math.ceil(rateCheck.waitTime / 1000);
      const errorMessage = {
        text: `Rate limit active. Please wait ${waitSeconds} seconds before sending another message.`,
        type: "error",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    const userMessage = { text: input, type: "user", timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Update rate limit state
    const now = Date.now();
    setRateLimitState(prev => ({
      ...prev,
      requestTimes: [...prev.requestTimes, now],
      requestCount: prev.requestCount + 1,
      backoffDelay: Math.min(prev.backoffDelay * 1.5, prev.maxBackoff)
    }));

    const currentInput = input;
    setInput("");

    try {
      // Prepare messages for OpenRouter API
      const systemMessage = customInstructions
        ? { role: "system", content: customInstructions }
        : {
          role: "system",
          content: "You are a helpful assistant.",
        };

      const conversationMessages = [
        systemMessage,
        ...messages
          .filter(msg => msg.type === "user" || msg.type === "bot")
          .map((msg) => ({
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
            "HTTP-Referer": window.location.origin,
            "X-Title": "DeepSeek R1 Chat",
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: conversationMessages,
            temperature: 0.7,
            max_tokens: 2000,
          }),
        }
      );

      // Extract and update rate limit info
      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
      const rateLimitReset = response.headers.get('x-ratelimit-reset');

      if (rateLimitRemaining) {
        setRateLimitState(prev => ({
          ...prev,
          remaining: parseInt(rateLimitRemaining),
          resetTime: rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000) : null
        }));
      }

      if (!response.ok) {
        const errorInfo = handleApiError(response, null);
        throw new Error(errorInfo.message);
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

        // Reset backoff delay on successful request
        setRateLimitState(prev => ({
          ...prev,
          backoffDelay: 1000
        }));
      } else {
        throw new Error("Invalid response format from API");
      }
    } catch (error) {
      console.error("Error calling OpenRouter API:", error);
      const errorInfo = handleApiError(null, error);
      const errorMessage = {
        text: errorInfo.message,
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
    setRateLimitState(prev => ({
      ...prev,
      requestCount: 0,
      requestTimes: [],
      backoffDelay: 1000
    }));
    setSidebarOpen(false);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const testApiKey = () => {
    const validation = validateApiKey(apiKey);
    const testMessage = {
      text: validation.valid
        ? "✅ API key format is correct! Try sending a message to test the connection."
        : `❌ ${validation.type === 'missing' ? 'Please enter an API key first' : 'Invalid API key format'}`,
      type: validation.valid ? "bot" : "error",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, testMessage]);
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
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <Key size={14} />
                API Configuration
              </h3>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your OpenRouter API key"
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded text-sm text-white mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-xs text-gray-400 mb-3">
                Get your API key from{' '}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300"
                >
                  openrouter.ai/keys
                </a>
              </div>
              <button
                onClick={testApiKey}
                className="w-full p-3 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white transition-colors mb-3"
              >
                Test API Key Format
              </button>
              <button
                onClick={() => setApiKey(DEFAULT_API_KEY)}
                className="w-full p-3 bg-green-600 hover:bg-green-700 rounded text-sm text-white transition-colors"
              >
                Use Default API Key
              </button>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Model Settings</h3>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Rate Limiting</h3>
              <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Requests</span>
                  <span className="text-xs text-white">{rateLimitState.requestCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Window</span>
                  <span className="text-xs text-white">{rateLimitState.requestTimes.length}/20</span>
                </div>
                {rateLimitState.remaining && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">API Remaining</span>
                    <span className="text-xs text-white">{rateLimitState.remaining}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Instructions</h3>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <div className="mb-1">API Status: {validateApiKey(apiKey).valid ? '✅ Valid' : '❌ Invalid'}</div>
              <div className="mb-1">Backoff: {rateLimitState.backoffDelay}ms</div>
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
          <div className="ml-auto flex items-center gap-2">
            {validateApiKey(apiKey).valid ? (
              <div className="flex items-center gap-2 text-green-600">
                <Shield size={16} />
                <span className="text-sm">API Ready</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-orange-600">
                <AlertCircle size={16} />
                <span className="text-sm">API Key Required</span>
              </div>
            )}
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center p-4">
              <div className="text-center max-w-md">
                <Bot size={48} className="mx-auto mb-4 text-gray-400" />
                <h2 className="text-xl lg:text-2xl font-semibold text-gray-800 mb-2">
                  DeepSeek R1 Chat Ready
                </h2>
                <p className="text-gray-600 mb-4">
                  Powered by DeepSeek R1 model with advanced reasoning capabilities
                </p>
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
                        : 'bg-purple-600 text-white'
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
                        <p className="whitespace-pre-wrap text-sm lg:text-base break-words">
                          {message.text}
                        </p>
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
                    <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center flex-shrink-0">
                      <Bot size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="p-3 lg:p-4 bg-white border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="animate-pulse text-sm lg:text-base">Thinking...</div>
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 lg:gap-3">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={validateApiKey(apiKey).valid ? "Ask DeepSeek R1 anything..." : "Enter API key in sidebar first..."}
                  className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm lg:text-base"
                  rows={1}
                  disabled={isLoading}
                  style={{ minHeight: '48px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim() || !validateApiKey(apiKey).valid}
                  className="absolute right-2 bottom-2 p-2 text-gray-500 hover:text-purple-500 disabled:text-gray-300 disabled:cursor-not-allowed"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2 text-center">
              <div>Press Enter to send, Shift+Enter for new line</div>
              {rateLimitState.remaining && rateLimitState.remaining < 5 && (
                <div className="text-orange-500 mt-1">
                  ⚠️ API Rate limit warning: {rateLimitState.remaining} requests remaining
                </div>
              )}
              {rateLimitState.requestTimes.length > 15 && (
                <div className="text-yellow-500 mt-1">
                  <Clock size={12} className="inline mr-1" />
                  Local rate limit: {rateLimitState.requestTimes.length}/20 requests in window
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