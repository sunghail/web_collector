export interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  default_favicon_id: string | null;
  order_index: number;
  created_at: string;
  links?: Link[];
}

export interface Link {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  url: string;
  favicon: string | null;
  show_favicon: boolean;
  memo: string | null;
  type: 'link' | 'macro';
  order_index: number;
  macro_items?: MacroItem[];
  created_at: string;
  updated_at: string;
}

export interface MacroItem {
  id: string;
  macro_id: string;
  link_id: string | null;
  custom_url: string | null;
  custom_title: string | null;
  custom_favicon: string | null;
  order_index: number;
  resolved_url?: string;
  resolved_title?: string;
  resolved_favicon?: string;
}

export interface MacroItemInput {
  link_id?: string;
  custom_url?: string;
  custom_title?: string;
  order_index: number;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export interface CategoryState {
  categories: Category[];
  isLoading: boolean;
  fetchCategories: () => Promise<void>;
  createCategory: (name: string, color: string, defaultFaviconId?: string | null) => Promise<void>;
  updateCategory: (id: string, name: string, color: string, defaultFaviconId?: string | null) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  reorderCategories: (categoryIds: string[]) => Promise<void>;
}

export interface LinkState {
  links: Link[];
  isLoading: boolean;
  fetchLinks: (categoryId?: string) => Promise<void>;
  createLink: (title: string, url: string, categoryId?: string) => Promise<void>;
  updateLink: (
    id: string,
    title: string,
    url: string,
    categoryId?: string,
    memo?: string,
    showFavicon?: boolean,
    favicon?: string
  ) => Promise<void>;
  deleteLink: (id: string) => Promise<void>;
  reorderLinks: (linkIds: string[]) => Promise<void>;
}
