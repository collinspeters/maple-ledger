import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "default_key"
});

export interface TransactionCategorizationResult {
  category: string;
  confidence: number;
  explanation: string;
  isExpense: boolean;
}

export interface ChatResponse {
  response: string;
  confidence: number;
  sqlQuery?: string;
}

export async function categorizeTransaction(
  vendor: string, 
  amount: number, 
  description: string
): Promise<TransactionCategorizationResult> {
  try {
    const prompt = `As a Canadian business expense categorization expert, analyze this transaction and categorize it according to CRA guidelines.

Transaction Details:
- Vendor: ${vendor}
- Amount: $${amount}
- Description: ${description}

Respond with JSON in this exact format:
{
  "category": "Office Supplies" | "Meals & Entertainment" | "Travel & Transportation" | "Professional Services" | "Marketing & Advertising" | "Utilities" | "Rent" | "Insurance" | "Revenue" | "Other",
  "confidence": 0.95,
  "explanation": "Brief explanation of why this category was chosen",
  "isExpense": true
}

Use these Canadian business expense categories:
- Office Supplies: stationery, software, equipment under $500
- Meals & Entertainment: business meals (50% deductible), client entertainment
- Travel & Transportation: business travel, gas, parking, public transit
- Professional Services: legal, accounting, consulting fees
- Marketing & Advertising: ads, promotional materials, website costs
- Utilities: internet, phone, electricity for business
- Rent: office space, equipment rental
- Insurance: business insurance premiums
- Revenue: income from clients, sales
- Other: miscellaneous business expenses

Consider Canadian tax rules and common business practices.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      category: result.category || "Other",
      confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
      explanation: result.explanation || "Unable to categorize automatically",
      isExpense: result.isExpense !== false, // Default to expense
    };
  } catch (error) {
    console.error("OpenAI categorization error:", error);
    return {
      category: "Other",
      confidence: 0,
      explanation: "AI categorization failed - manual review required",
      isExpense: true,
    };
  }
}

export async function processFinancialQuery(
  query: string,
  userId: string,
  financialData?: any
): Promise<ChatResponse> {
  try {
    const prompt = `You are a financial AI assistant for Canadian sole proprietors. Answer this query about their business finances:

Query: ${query}

Available data context: ${financialData ? JSON.stringify(financialData) : 'No specific data provided'}

Provide a helpful, accurate response about Canadian business finances, tax implications, or bookkeeping advice. If you need specific financial data that isn't provided, explain what information would be needed.

Respond with JSON in this format:
{
  "response": "Your helpful response here",
  "confidence": 0.95
}

Keep responses concise but informative. Include Canadian tax considerations when relevant.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      response: result.response || "I'm sorry, I couldn't process your query. Please try rephrasing it.",
      confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
    };
  } catch (error) {
    console.error("OpenAI chat error:", error);
    return {
      response: "I'm experiencing technical difficulties. Please try your question again later.",
      confidence: 0,
    };
  }
}

export async function extractReceiptData(ocrText: string): Promise<{
  vendor?: string;
  amount?: number;
  date?: string;
  confidence: number;
}> {
  try {
    const prompt = `Extract key information from this receipt OCR text:

${ocrText}

Extract and return JSON with:
{
  "vendor": "Business name",
  "amount": 123.45,
  "date": "2024-01-15",
  "confidence": 0.95
}

If information is unclear or missing, omit that field. Date should be YYYY-MM-DD format.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      vendor: result.vendor,
      amount: result.amount,
      date: result.date,
      confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
    };
  } catch (error) {
    console.error("OpenAI receipt extraction error:", error);
    return {
      confidence: 0,
    };
  }
}

export interface ParsedTransaction {
  amount: number;
  description: string;
  vendor?: string;
  category?: string;
  date: string;
  confidence: number;
  action: 'add_transaction' | 'add_expense' | 'query_data';
  isExpense: boolean;
}

export async function parseNaturalLanguageTransaction(text: string): Promise<ParsedTransaction> {
  try {
    const prompt = `You are a Canadian bookkeeping AI assistant. Parse this natural language input into structured transaction data or identify if it's a query.

Input: "${text}"

Respond with JSON in this exact format:
{
  "action": "add_transaction" | "add_expense" | "query_data",
  "amount": 123.45,
  "description": "Clear transaction description",
  "vendor": "Vendor name if mentioned",
  "category": "Office Supplies" | "Meals & Entertainment" | "Travel & Transportation" | "Professional Services" | "Marketing & Advertising" | "Utilities" | "Rent" | "Insurance" | "Revenue" | "Other",
  "date": "2024-01-31T12:00:00.000Z",
  "confidence": 0.95,
  "isExpense": true
}

Guidelines:
- If amount mentioned: action = "add_transaction" or "add_expense"
- If asking questions like "how much", "what did I spend": action = "query_data"
- Parse relative dates: "yesterday", "Monday", "last week", etc.
- Extract vendor names from context
- Categorize according to Canadian business expense categories
- Default to today's date if no date mentioned
- Set confidence based on clarity of the input (0.0 to 1.0)
- Revenue transactions have isExpense: false
- Expenses have isExpense: true`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Parse and validate the date
    let parsedDate = new Date();
    if (result.date) {
      try {
        parsedDate = new Date(result.date);
        if (isNaN(parsedDate.getTime())) {
          parsedDate = new Date();
        }
      } catch {
        parsedDate = new Date();
      }
    }
    
    return {
      action: result.action || "add_expense",
      amount: Math.abs(parseFloat(result.amount) || 0),
      description: result.description || text,
      vendor: result.vendor || undefined,
      category: result.category || "Other",
      date: parsedDate.toISOString(),
      confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
      isExpense: result.isExpense !== false,
    };
  } catch (error) {
    console.error("OpenAI natural language parsing error:", error);
    return {
      action: "add_expense",
      amount: 0,
      description: text,
      date: new Date().toISOString(),
      confidence: 0,
      isExpense: true,
    };
  }
}
