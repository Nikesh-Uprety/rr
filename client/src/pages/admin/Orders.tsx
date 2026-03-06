import { MOCK_ORDERS } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AdminOrders() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">Orders</h1>
          <p className="text-muted-foreground mt-1">12 orders • All</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-white dark:bg-card border-[#E5E5E0] dark:border-border text-[#2C3E2D] dark:text-foreground">
            All Status
          </Button>
          <Button variant="outline" className="bg-white dark:bg-card border-[#E5E5E0] dark:border-border text-[#2C3E2D] dark:text-foreground">
            Export CSV
          </Button>
        </div>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search orders, customers..." 
          className="pl-9 bg-white dark:bg-card border-[#E5E5E0] dark:border-border rounded-full h-11"
        />
      </div>

      <div className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-transparent border-b border-[#E5E5E0] dark:border-border text-xs uppercase text-muted-foreground font-semibold tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">Order</th>
                <th className="px-6 py-4 font-medium">Customer</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Items</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E0] dark:divide-border">
              {MOCK_ORDERS.map((order) => (
                <tr key={order.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 font-medium">{order.orderNumber}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-[#2C3E2D] dark:text-foreground">{order.customerName}</div>
                    <div className="text-muted-foreground text-xs">{order.customerEmail}</div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{order.date}</td>
                  <td className="px-6 py-4 text-muted-foreground">{order.items} {order.items === 1 ? 'item' : 'items'}</td>
                  <td className="px-6 py-4">
                    <Badge 
                      variant="outline" 
                      className={`border-none ${
                        order.status === 'Completed' 
                          ? "bg-[#E8F3EB] text-[#2C5234] dark:bg-green-950 dark:text-green-300" 
                          : order.status === 'Pending' 
                            ? "bg-[#FFF4E5] text-[#8C5A14] dark:bg-yellow-950 dark:text-yellow-300" 
                            : "bg-[#FDECEC] text-[#9A2D2D] dark:bg-red-950 dark:text-red-300"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        order.status === 'Completed' ? "bg-[#2C5234] dark:bg-green-400" : 
                        order.status === 'Pending' ? "bg-[#8C5A14] dark:bg-yellow-400" : 
                        "bg-[#9A2D2D] dark:bg-red-400"
                      }`} />
                      {order.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right font-medium">${order.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}