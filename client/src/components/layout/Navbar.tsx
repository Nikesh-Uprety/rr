import { Link } from "wouter";
import { ShoppingBag, Search, Menu, User, Sun, Moon, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/store/theme";
import { useCartStore } from "@/store/cart";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Navbar() {
  const { theme, setTheme } = useThemeStore();
  const cartItemsCount = useCartStore(state => state.items.reduce((acc, item) => acc + item.quantity, 0));

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4 lg:hidden">
          <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-menu">
            <Menu className="h-5 w-5" />
          </Button>
          <Search className="h-5 w-5 text-muted-foreground lg:hidden" />
        </div>

        <div className="hidden lg:flex items-center gap-8 text-sm font-medium">
          <Link href="/products?category=tops" className="hover:text-primary transition-colors" data-testid="link-nav-tops">Tops</Link>
          <Link href="/products?category=bottoms" className="hover:text-primary transition-colors" data-testid="link-nav-bottoms">Bottoms</Link>
          <Link href="/products?category=accessories" className="hover:text-primary transition-colors" data-testid="link-nav-accessories">Accessories</Link>
        </div>

        <Link href="/" className="text-2xl font-serif font-bold tracking-tight" data-testid="link-home">
          Urban Threads.
        </Link>

        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-4">
            <Search className="h-5 w-5 text-muted-foreground cursor-pointer hover:text-primary transition-colors" data-testid="icon-search" />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-theme-toggle">
                  {theme === 'light' && <Sun className="h-5 w-5" />}
                  {theme === 'dark' && <Moon className="h-5 w-5" />}
                  {theme === 'warm' && <Coffee className="h-5 w-5" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme('light')} data-testid="menu-item-light-theme">Light</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')} data-testid="menu-item-dark-theme">Dark</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('warm')} data-testid="menu-item-warm-theme">Warm</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link href="/admin" data-testid="link-nav-admin">
              <User className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
            </Link>
          </div>
          
          <Link href="/cart" className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-muted transition-colors" data-testid="link-cart">
            <ShoppingBag className="h-5 w-5 text-foreground" />
            {cartItemsCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm">
                {cartItemsCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </nav>
  );
}