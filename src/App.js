import { useState, useEffect, useRef, useCallback } from "react";
import { Menu, Plus, MessageSquare, Settings, User, Send, Bot, X, Clock, AlertCircle } from "lucide-react";

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);

  // Google Gemini API key
  const API_KEY = "AIzaSyAoIbebMPglU6XdOtLOrWbRU1HcyR8JyyQ";
  const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash");
  const [customInstructions, setCustomInstructions] = useState(
    "You are a helpful AI assistant. Provide clear, concise, and actionable responses to user queries."
  );

  // Debug state
  const [debugInfo, setDebugInfo] = useState({
    lastRequest: null,
    lastResponse: null,
    lastError: null
  });

  // Rate limiting state
  const [rateLimitState, setRateLimitState] = useState({
    requestTimes: [],
    backoffDelay: 1000,
    maxBackoff: 16000,
    requestCount: 0
  });

  // Google Gemini models
  const availableModels = [
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
    { id: "gemini-1.0-pro", name: "Gemini 1.0 Pro" }
  ];

  // Rate limiting check
  const checkRateLimit = useCallback(() => {
    const now = Date.now();
    const windowSize = 60000; // 1 minute
    const maxRequests = 60; // Gemini has higher rate limits

    const recentRequests = rateLimitState.requestTimes.filter(
      time => now - time < windowSize
    );

    if (recentRequests.length >= maxRequests) {
      const oldestRequest = Math.min(...recentRequests);
      const waitTime = windowSize - (now - oldestRequest);
      return { allowed: false, waitTime };
    }

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

  // Enhanced error handling with debugging
  const handleApiError = useCallback(async (response, error) => {
    let errorMessage = "An unexpected error occurred";
    let debugData = null;

    if (response) {
      try {
        const responseText = await response.text();
        debugData = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseText
        };

        // Try to parse JSON error message
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.error && errorData.error.message) {
            errorMessage = errorData.error.message;
          }
        } catch (e) {
          // If not JSON, use response text
          if (responseText) {
            errorMessage = responseText;
          }
        }
      } catch (e) {
        console.error("Error reading response:", e);
      }

      switch (response.status) {
        case 400:
          errorMessage = `Bad request: ${errorMessage}`;
          break;
        case 401:
          errorMessage = `Authentication failed: ${errorMessage}. Please check your API key.`;
          break;
        case 403:
          errorMessage = `Access denied: ${errorMessage}`;
          break;
        case 429:
          errorMessage = `Rate limit exceeded: ${errorMessage}`;
          break;
        case 500:
          errorMessage = `Server error: ${errorMessage}`;
          break;
        case 502:
        case 503:
        case 504:
          errorMessage = `Service unavailable: ${errorMessage}`;
          break;
        default:
          errorMessage = `API error (${response.status}): ${errorMessage}`;
      }
    } else if (error) {
      debugData = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };

      if (error.name === 'NetworkError' || error.message.includes('fetch')) {
        errorMessage = "Network error. Please check your connection.";
      } else {
        errorMessage = error.message;
      }
    }

    setDebugInfo(prev => ({
      ...prev,
      lastError: debugData
    }));

    return errorMessage;
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Validate API key on component mount
  useEffect(() => {
    if (!API_KEY || API_KEY === '' || API_KEY === 'undefined') {
      const errorMessage = {
        text: "❌ No API key found. Please set your Google Gemini API key.",
        type: "error",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [API_KEY]);

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage = {
      text: "Welcome to Google Gemini AI Chat! Select a model and start chatting.",
      type: "bot",
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, []);

  // Test API connection
  const testApiConnection = async () => {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const testMessage = {
          text: `✅ API connection successful! Found ${data.models?.length || 0} available models.`,
          type: "bot",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, testMessage]);
      } else {
        const errorMessage = await handleApiError(response, null);
        const testMessage = {
          text: `❌ API connection failed: ${errorMessage}`,
          type: "error",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, testMessage]);
      }
    } catch (error) {
      const errorMessage = await handleApiError(null, error);
      const testMessage = {
        text: `❌ API connection failed: ${errorMessage}`,
        type: "error",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, testMessage]);
    }
  };

  const handleSend = async () => {
    if (input.trim() === "") return;

    // Check rate limiting
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      const waitSeconds = Math.ceil(rateCheck.waitTime / 1000);
      const errorMessage = {
        text: `Please wait ${waitSeconds} seconds before sending another message.`,
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
      backoffDelay: Math.min(prev.backoffDelay * 1.2, prev.maxBackoff)
    }));

    const currentInput = input;
    setInput("");

    try {
      // Build conversation history for context
      const conversationHistory = messages
        .filter(msg => msg.type === "user" || msg.type === "bot")
        .map(msg => `${msg.type === "user" ? "User" : "Assistant"}: ${msg.text}`)
        .join("\n");

      const systemPrompt = customInstructions;
      const fullPrompt = conversationHistory
        ? `${systemPrompt}\n\nConversation history:\n${conversationHistory}\n\nUser: ${currentInput}`
        : `${systemPrompt}\n\nUser: ${currentInput}`;

      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: fullPrompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          topP: 0.8,
          topK: 40
        }
      };

      setDebugInfo(prev => ({
        ...prev,
        lastRequest: {
          url: `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": `${API_KEY.substring(0, 20)}...`,
          },
          body: requestBody
        }
      }));

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorMessage = await handleApiError(response, null);
        throw new Error(errorMessage);
      }

      const data = await response.json();

      setDebugInfo(prev => ({
        ...prev,
        lastResponse: data
      }));

      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        const botResponse = {
          text: data.candidates[0].content.parts[0].text,
          type: "bot",
          timestamp: new Date(),
          model: selectedModel,
        };
        setMessages((prev) => [...prev, botResponse]);

        // Reset backoff on success
        setRateLimitState(prev => ({
          ...prev,
          backoffDelay: 1000
        }));
      } else {
        throw new Error("Invalid response format from API");
      }
    } catch (error) {
      console.error("Error:", error);
      const errorMessage = await handleApiError(null, error);
      const errorMsg = {
        text: errorMessage,
        type: "error",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
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
    setMessages([{
      text: "New chat started! How can I help you today?",
      type: "bot",
      timestamp: new Date(),
    }]);
    setInput("");
    setRateLimitState(prev => ({
      ...prev,
      requestCount: 0,
      requestTimes: [],
      backoffDelay: 1000
    }));
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 relative">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed lg:relative lg:translate-x-0 w-80 lg:w-64 h-full transition-transform duration-300 bg-gray-900 text-white flex flex-col z-50`}>
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4 lg:mb-0">
            <h2 className="text-lg font-semibold lg:hidden">Chat Settings</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-gray-800 rounded-lg lg:hidden"
            >
              <X size={20} />
            </button>
          </div>
          <div className="space-y-2">
            <button
              onClick={handleNewChat}
              className="flex items-center gap-2 w-full p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Plus size={16} />
              <span>New Chat</span>
            </button>
            <button
              onClick={testApiConnection}
              className="flex items-center gap-2 w-full p-3 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            >
              <AlertCircle size={16} />
              <span>Test API</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Google Gemini Models</h3>
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
              <h3 className="text-sm font-medium text-gray-400 mb-3">API Debug Info</h3>
              <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">API Key Status</span>
                  <span className={`text-xs ${API_KEY && API_KEY !== '' && API_KEY !== 'undefined' ? 'text-green-400' : 'text-red-400'}`}>
                    {API_KEY && API_KEY !== '' && API_KEY !== 'undefined' ? '✅ Loaded' : '❌ Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">API Provider</span>
                  <span className="text-xs text-white">Google Gemini</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Key Preview</span>
                  <span className="text-xs text-green-400">
                    {API_KEY ? API_KEY.substring(0, 15) + "..." : "Not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Model</span>
                  <span className="text-xs text-white">{selectedModel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Last Error</span>
                  <span className="text-xs text-red-400">
                    {debugInfo.lastError ? "Check Console" : "None"}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Rate Limiting</h3>
              <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Total Requests</span>
                  <span className="text-xs text-white">{rateLimitState.requestCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Current Window</span>
                  <span className="text-xs text-white">{rateLimitState.requestTimes.length}/60</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Backoff Delay</span>
                  <span className="text-xs text-white">{rateLimitState.backoffDelay}ms</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Instructions</h3>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Enter custom instructions for the AI..."
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
              <div className="mb-1">Status: ✅ Google Gemini Active</div>
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
          <h1 className="text-xl font-semibold text-gray-800 truncate">Google Gemini AI Chat</h1>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2 text-blue-600">
              <Bot size={16} />
              <span className="text-sm">Gemini AI</span>
            </div>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto py-4 lg:py-8 px-4">
            {messages.map((message, index) => (
              <div key={index} className={`mb-6 lg:mb-8 ${message.type === 'user' ? 'ml-auto' : ''}`}>
                <div className="flex items-start gap-2 lg:gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.type === 'user'
                    ? 'bg-blue-500 text-white order-2'
                    : message.type === 'error'
                      ? 'bg-red-500 text-white'
                      : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
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
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0">
                    <Bot size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="p-3 lg:p-4 bg-white border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="animate-pulse text-sm lg:text-base">Thinking...</div>
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
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
                  placeholder="Ask me anything..."
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
              {rateLimitState.requestTimes.length > 45 && (
                <div className="text-yellow-500 mt-1">
                  <Clock size={12} className="inline mr-1" />
                  Rate limit: {rateLimitState.requestTimes.length}/60 requests in current window
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