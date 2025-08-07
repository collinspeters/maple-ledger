import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/
import ErrorBoundary from "@/components/ui/error-boundary";
card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import React from "react";
import {
  BookOpen,
  Search,
  DollarSign,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Building2,
  Filter,
  Plus
} from "lucide-react";

interface AccountType {
  id: string;
  name: string;
  category: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  subcategory?: string;
  code: string;
  description: string;
  isDeductible?: boolean;
  deductionRate?: number;
  t2125Category?: string;
  isActive: boolean;
  parentId?: string;
}

export default function ChartOfAccountsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const { data: accounts, isLoading, error } = useQuery<AccountType[]>({
    queryKey: ['/api/chart-of-accounts'],
  });

  if (isLoading) {
    return (
      <div className="p-6">
      <ErrorBoundary>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded">
      </ErrorBoundary>
    </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !accounts) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-red-600">Error loading chart of accounts. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter accounts based on search and category
  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = !searchTerm || 
      account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.code.includes(searchTerm) ||
      account.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = activeCategory === 'all' || account.category === activeCategory;
    
    return matchesSearch && matchesCategory && account.isActive;
  });

  // Group accounts by category
  const accountsByCategory = filteredAccounts.reduce((acc, account) => {
    if (!acc[account.category]) acc[account.category] = [];
    acc[account.category].push(account);
    return acc;
  }, {} as Record<string, AccountType[]>);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ASSET': return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'LIABILITY': return <CreditCard className="h-5 w-5 text-red-600" />;
      case 'EQUITY': return <Building2 className="h-5 w-5 text-blue-600" />;
      case 'REVENUE': return <DollarSign className="h-5 w-5 text-green-600" />;
      case 'EXPENSE': return <TrendingDown className="h-5 w-5 text-orange-600" />;
      default: return <BookOpen className="h-5 w-5 text-gray-600" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'ASSET': return 'bg-green-100 text-green-800';
      case 'LIABILITY': return 'bg-red-100 text-red-800';
      case 'EQUITY': return 'bg-blue-100 text-blue-800';
      case 'REVENUE': return 'bg-green-100 text-green-800';
      case 'EXPENSE': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const categoryStats = Object.entries(accountsByCategory).map(([category, categoryAccounts]) => ({
    category,
    count: categoryAccounts.length,
    color: getCategoryColor(category),
    icon: getCategoryIcon(category)
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Chart of Accounts</h1>
          <p className="text-gray-600 mt-1">Organize your business finances with Canadian T2125 compliance</p>
        </div>
        <Button onClick={() => console.log('Button clicked')} aria-label="Button action">
          <Plus className="h-4 w-4 mr-2" />
          Add Account
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {categoryStats.map(({ category, count, color, icon }) => (
          <Card key={category} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setActiveCategory(activeCategory === category ? 'all' : category)}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                {icon}
                <div>
                  <div className="text-sm font-medium text-gray-900">{category.replace('_', ' ')}</div>
                  <div className="text-2xl font-bold text-gray-900">{count}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search accounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="ASSET">Assets</TabsTrigger>
            <TabsTrigger value="LIABILITY">Liabilities</TabsTrigger>
            <TabsTrigger value="EQUITY">Equity</TabsTrigger>
            <TabsTrigger value="REVENUE">Revenue</TabsTrigger>
            <TabsTrigger value="EXPENSE">Expenses</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5" />
            <span>Account Details</span>
            <Badge variant="secondary">{filteredAccounts.length} accounts</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 p-3 border-b font-medium text-sm text-gray-600">
              <div className="col-span-2">Code</div>
              <div className="col-span-3">Account Name</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-3">Description</div>
              <div className="col-span-1">T2125</div>
              <div className="col-span-1">Deductible</div>
            </div>

            {/* Accounts */}
            {filteredAccounts.map((account) => (
              <div key={account.id} 
                   className="grid grid-cols-12 gap-4 p-3 hover:bg-gray-50 border-b border-gray-100 rounded-lg">
                <div className="col-span-2">
                  <span className="font-mono text-sm font-medium">{account.code}</span>
                </div>
                
                <div className="col-span-3">
                  <div className="font-medium text-gray-900">{account.name}</div>
                  {account.subcategory && (
                    <div className="text-xs text-gray-500">{account.subcategory}</div>
                  )}
                </div>
                
                <div className="col-span-2">
                  <Badge className={getCategoryColor(account.category)}>
                    {account.category}
                  </Badge>
                </div>
                
                <div className="col-span-3">
                  <span className="text-sm text-gray-600">{account.description}</span>
                </div>
                
                <div className="col-span-1">
                  {account.t2125Category && (
                    <Badge variant="outline" className="text-xs">
                      T2125
                    </Badge>
                  )}
                </div>
                
                <div className="col-span-1">
                  {account.isDeductible && (
                    <div className="text-center">
                      <Badge variant="secondary" className="text-xs">
                        {account.deductionRate ? `${(account.deductionRate * 100).toFixed(0)}%` : '100%'}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredAccounts.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No accounts found matching your criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}