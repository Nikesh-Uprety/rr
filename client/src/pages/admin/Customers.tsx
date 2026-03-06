import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { MOCK_ORDERS } from "@/lib/mockData";

export default function AdminCustomers() {
  // Extract unique customers from mock orders
  const customers = Array.from(new Set(MOCK_ORDERS.map(o => o.customerEmail)))
    .map(email => {
      const orders = MOCK_ORDERS.filter(o => o.customerEmail === email);
      return {
        id: email,
        name: orders[0].customerName,
        email: email,
        totalSpent: orders.reduce((sum, o) => sum + o.amount, 0),
        initials: orders[0].customerName.split(' ').map(n => n[0]).join('')
      };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">Customers</h1>
          <p className="text-muted-foreground mt-1">{customers.length} customers</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-white dark:bg-card border-[#E5E5E0] dark:border-border text-[#2C3E2D] dark:text-foreground">
            Export
          </Button>
          <Button className="bg-[#2C3E2D] hover:bg-[#1A251B] text-white dark:bg-primary dark:text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Add Customer
          </Button>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="relative w-full mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search customers..." 
              className="pl-9 bg-white dark:bg-card border-[#E5E5E0] dark:border-border rounded-full h-11"
            />
          </div>

          <div className="bg-transparent flex-1 overflow-y-auto pr-4 space-y-2">
            {customers.map((customer, i) => {
              const bgColors = ["bg-[#2C5234]", "bg-[#1E40AF]", "bg-[#8B2020]", "bg-[#926019]", "bg-[#1B6A68]", "bg-[#4B3B6D]"];
              const bgColor = bgColors[i % bgColors.length];
              
              return (
                <div key={customer.id} className="flex items-center justify-between p-4 rounded-xl hover:bg-white dark:hover:bg-card transition-colors cursor-pointer group border border-transparent hover:border-[#E5E5E0] dark:hover:border-border">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full ${bgColor} text-white flex items-center justify-center font-medium text-sm`}>
                      {customer.initials}
                    </div>
                    <div>
                      <div className="font-medium text-[#2C3E2D] dark:text-foreground group-hover:text-primary transition-colors">{customer.name}</div>
                      <div className="text-muted-foreground text-sm">{customer.email}</div>
                    </div>
                  </div>
                  <div className="font-medium">
                    ${customer.totalSpent.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Customer Detail Pane - Placeholder */}
        <div className="hidden lg:flex w-80 bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border flex-col items-center justify-center p-8 text-center text-muted-foreground">
          <p>Select a customer</p>
        </div>
      </div>
    </div>
  );
}