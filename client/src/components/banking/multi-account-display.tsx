import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Banknote, 
  ArrowRightLeft, 
  Eye, 
  EyeOff, 
  CreditCard, 
  Wallet,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface BankAccount {
  id: string;
  accountName: string;
  accountType: string;
  accountMask: string;
  balance?: {
    available: number;
    current: number;
  };
  isActive: boolean;
}

interface BankGroup {
  bankName: string;
  itemId: string;
  accounts: BankAccount[];
  totalAccounts: number;
}

interface TransferSummary {
  totalTransfers: number;
  internalTransfers: number;
  externalTransfers: number;
  unmatchedTransfers: number;
  transferAmount: number;
}

interface MultiAccountDisplayProps {
  bankGroups: BankGroup[];
  transferSummary: TransferSummary;
  onDisconnectAccount: (accountId: string) => void;
  onViewTransfers: (bankName: string) => void;
}

import React from "react";

const MultiAccountDisplay = React.memo(function MultiAccountDisplay({ 
  bankGroups, 
  transferSummary, 
  onDisconnectAccount,
  onViewTransfers 
}: MultiAccountDisplayProps) {
  const [showBalances, setShowBalances] = useState(false);
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set());

  const toggleBankExpansion = (itemId: string) => {
    const newExpanded = new Set(expandedBanks);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedBanks(newExpanded);
  };

  const getAccountIcon = (accountType: string) => {
    switch (accountType.toLowerCase()) {
      case 'checking':
      case 'chequing':
        return <Wallet className="h-4 w-4" />;
      case 'savings':
        return <Banknote className="h-4 w-4" />;
      case 'credit':
        return <CreditCard className="h-4 w-4" />;
      default:
        return <Banknote className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Transfer Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer Activity
          </CardTitle>
          <CardDescription>
            Summary of transfers between your accounts and external sources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {transferSummary.totalTransfers}
              </div>
              <div className="text-sm text-muted-foreground">Total Transfers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {transferSummary.internalTransfers}
              </div>
              <div className="text-sm text-muted-foreground">Between Your Accounts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {transferSummary.externalTransfers}
              </div>
              <div className="text-sm text-muted-foreground">External Transfers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {transferSummary.unmatchedTransfers}
              </div>
              <div className="text-sm text-muted-foreground">Need Review</div>
            </div>
          </div>
          
          {transferSummary.transferAmount > 0 && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Total Transfer Volume</div>
              <div className="text-xl font-semibold">
                ${transferSummary.transferAmount.toLocaleString('en-CA', { 
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2 
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Multi-Account Display */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Connected Bank Accounts</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBalances(!showBalances)}
            className="flex items-center gap-2"
          >
            {showBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showBalances ? 'Hide' : 'Show'} Balances
          </Button>
        </div>

        {bankGroups.map((bank) => (
          <Card key={bank.itemId} className="overflow-hidden">
            <CardHeader 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleBankExpansion(bank.itemId)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    {bank.bankName}
                  </CardTitle>
                  <CardDescription>
                    {bank.totalAccounts} account{bank.totalAccounts !== 1 ? 's' : ''} connected
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Connected
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewTransfers(bank.bankName);
                    }}
                  >
                    View Transfers
                  </Button>
                </div>
              </div>
            </CardHeader>

            {expandedBanks.has(bank.itemId) && (
              <CardContent className="pt-0">
                <Separator className="mb-4" />
                <div className="space-y-3">
                  {bank.accounts.map((account) => (
                    <div 
                      key={account.id} 
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {getAccountIcon(account.accountType)}
                        <div>
                          <div className="font-medium">
                            {account.accountName}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {account.accountType}
                            </Badge>
                            {account.accountMask && (
                              <span>•••• {account.accountMask}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {showBalances && account.balance && (
                          <div className="text-right">
                            <div className="font-medium">
                              ${account.balance.current.toLocaleString('en-CA', { 
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2 
                              })}
                            </div>
                            {account.balance.available !== account.balance.current && (
                              <div className="text-xs text-muted-foreground">
                                ${account.balance.available.toLocaleString('en-CA', { 
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2 
                                })} available
                              </div>
                            )}
                          </div>
                        )}
                        
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onDisconnectAccount(account.id)}
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                    How Transfers Work
                  </h4>
                  <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3 w-3" />
                      <span><strong>Internal transfers</strong> between your accounts are automatically detected and paired</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-3 w-3" />
                      <span><strong>External transfers</strong> to/from other banks are categorized separately</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="h-3 w-3" />
                      <span><strong>Matched transfers</strong> don't count as income or expenses in your reports</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {bankGroups.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Banknote className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Bank Accounts Connected</h3>
            <p className="text-muted-foreground mb-4">
              Connect your bank accounts to start tracking transactions and transfers automatically.
            </p>
            <Button>Connect Your First Bank Account</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}