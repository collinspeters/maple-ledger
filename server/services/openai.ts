import OpenAI from "openai";
import { T2125_CATEGORIES, getExpenseCategories, getIncomeCategories, TRANSACTION_MAPPINGS, type T2125Category } from "@shared/t2125-categories";

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
  description: string,
  enrichedContext?: string
): Promise<TransactionCategorizationResult> {
  try {
    // Generate the category list from official T2125 categories
    const expenseCategories = getExpenseCategories();
    const incomeCategories = getIncomeCategories();
    
    const categoryList = expenseCategories.map(cat => 
      `- ${cat.name} (${cat.code}): ${cat.description}${cat.notes ? ` - ${cat.notes}` : ''}`
    ).join('\n');
    
    const incomeList = incomeCategories.map(cat =>
      `- ${cat.name} (${cat.code}): ${cat.description}`
    ).join('\n');

    const prompt = `You are an AI bookkeeper categorizing transactions for a Canadian sole proprietor using official T2125 tax form categories.

Transaction Details:
- Raw Description: ${description}
- Vendor/Merchant: ${vendor}
- Amount: $${amount}
${enrichedContext ? `- Enriched Context: ${enrichedContext}` : ''}

OFFICIAL T2125 EXPENSE CATEGORIES (choose from these only):
${categoryList}

INCOME CATEGORIES:
${incomeList}

IMPORTANT RULES:
- Use ONLY the category codes provided above (e.g., "OFFICE_EXPENSES", "MEALS_ENTERTAINMENT")
- For income transactions, use "BUSINESS_INCOME" or "PROFESSIONAL_INCOME"
- Consider Canadian tax compliance and T2125 form requirements
- Use enriched merchant context to improve accuracy
- Set confidence higher (0.8+) when merchant context clearly indicates business type
- Remember: MEALS_ENTERTAINMENT is only 50% deductible, VEHICLE_EXPENSES require business use logs

Based on the transaction details and enriched context, determine the most accurate T2125 category.

Respond with JSON in this exact format:
{
  "category": "OFFICE_EXPENSES",
  "confidence": 0.95,
  "explanation": "Brief explanation of why this T2125 category was chosen based on merchant context and tax rules",
  "isExpense": true
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Validate that the returned category exists in our T2125 categories
    const validCategory = T2125_CATEGORIES.find(cat => cat.code === result.category);
    
    return {
      category: validCategory ? result.category : "OTHER_EXPENSES",
      confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
      explanation: result.explanation || "Unable to categorize automatically",
      isExpense: result.isExpense !== false, // Default to expense
    };
  } catch (error) {
    console.error("OpenAI categorization error:", error);
    return {
      category: "OTHER_EXPENSES",
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
