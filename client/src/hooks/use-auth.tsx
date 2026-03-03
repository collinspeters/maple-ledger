import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AuthUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user, isLoading, error } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: false,
    staleTime: 5 * 60 * 1000, // 5 minutes instead of Infinity
    queryFn: async () => {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.status === 401) {
          return null; // User is not authenticated
        }
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.user;
      } catch (error: any) {
        console.error('Auth check error:', error);
        return null; // Default to not authenticated on error
      }
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data.user);
      toast({
        title: "Welcome back!",
        description: "You have been logged in successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: {
      email: string;
      password: string;
      username: string;
      businessName?: string;
      firstName?: string;
      lastName?: string;
    }) => {
      const response = await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(userData),
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data.user);
      const verifySuffix = data?.verifyToken
        ? ` Verify: /verify-email?token=${data.verifyToken}`
        : "";
      toast({
        title: "Account Created!",
        description: `Your account has been created and your 14-day trial has started.${verifySuffix}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/auth/logout", {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
      toast({
        title: "Logged Out",
        description: "You have been logged out successfully.",
      });
    },
  });

  return {
    user,
    isLoading,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: logoutMutation.mutate,
    isLoginLoading: loginMutation.isPending,
    isRegisterLoading: registerMutation.isPending,
    isLogoutLoading: logoutMutation.isPending,
  };
}
