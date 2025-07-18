import React, { useState, useEffect, useCallback } from "react";
import { Category } from "@/entities/Category"; // Assuming Category entity exists
import { Video } from "@/entities/Video"; // To update videos when a category is deleted/merged
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Trash2, Edit2, Palette, Tag, Check, X, Loader2, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "../components/LanguageProvider";
import { Label } from "@/components/ui/label";

const defaultColors = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500", 
  "bg-lime-500", "bg-green-500", "bg-emerald-500", "bg-teal-500", 
  "bg-cyan-500", "bg-sky-500", "bg-blue-500", "bg-indigo-500", 
  "bg-violet-500", "bg-purple-500", "bg-fuchsia-500", "bg-pink-500", "bg-rose-500"
];

export default function ManageCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(defaultColors[0]);
  
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const cats = await Category.list();
      // Sort categories alphabetically by name for consistent display
      setCategories(cats.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error loading categories:", error);
      toast({ title: t.error_loading_categories_title, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({ title: t.category_name_required_title, variant: "warning" });
      return;
    }
    // Check for duplicate category name (case-insensitive)
    if (categories.some(cat => cat.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
        toast({ title: t.category_name_exists_title, description: t.category_name_exists_desc, variant: "warning" });
        return;
    }
    try {
      await Category.create({ name: newCategoryName.trim(), color: newCategoryColor });
      setIsAddDialogOpen(false);
      setNewCategoryName("");
      setNewCategoryColor(defaultColors[0]);
      await loadCategories();
      toast({ title: t.category_added_success_title });
    } catch (error) {
      toast({ title: t.error_adding_category_title, variant: "destructive" });
    }
  };

  const handleEditCategory = async () => {
    if (!editingCategory || !editingCategory.name.trim()) {
      toast({ title: t.category_name_required_title, variant: "warning" });
      return;
    }
     // Check for duplicate category name (case-insensitive), excluding the current category being edited
    if (categories.some(cat => cat.id !== editingCategory.id && cat.name.toLowerCase() === editingCategory.name.trim().toLowerCase())) {
        toast({ title: t.category_name_exists_title, description: t.category_name_exists_desc, variant: "warning" });
        return;
    }
    try {
      await Category.update(editingCategory.id, { name: editingCategory.name.trim(), color: editingCategory.color });
      setIsEditDialogOpen(false);
      setEditingCategory(null);
      await loadCategories();
      toast({ title: t.category_updated_success_title });
    } catch (error) {
      toast({ title: t.error_updating_category_title, variant: "destructive" });
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      // Find videos using this category
      const videosToUpdate = await Video.filter({ category: categoryToDelete.name });
      // Update videos to remove this category (set to null or a default category)
      const updatePromises = videosToUpdate.map(video => Video.update(video.id, { category: null })); // Or some default
      await Promise.all(updatePromises);

      await Category.delete(categoryToDelete.id);
      setIsDeleteDialogOpen(false);
      setCategoryToDelete(null);
      await loadCategories();
      toast({ title: t.category_deleted_success_title, description: t.category_deleted_desc });
    } catch (error) {
      toast({ title: t.error_deleting_category_title, variant: "destructive" });
    }
  };

  const openEditDialog = (category) => {
    setEditingCategory({ ...category }); // Clone to avoid direct state mutation
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (category) => {
    setCategoryToDelete(category);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("Settings")} aria-label={t.back_to_settings || "Back to Settings"}>
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t.manage_categories_page_title || "Manage Categories"}</h1>
          <p className="text-gray-500 mt-1">{t.manage_categories_page_subtitle || "Add, edit, or delete video categories."}</p>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>{t.categories_list_title || "Your Categories"}</CardTitle>
                <CardDescription>{t.categories_list_desc || `You have ${categories.length} categories.`}</CardDescription>
            </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> {t.add_category_button || "Add Category"}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-10 border border-dashed rounded-md">
              <Tag className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">{t.no_categories_found_desc || "No categories found. Add your first category!"}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {categories.map(category => (
                <li key={category.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-sm ${category.color}`}></div>
                    <span className="font-medium">{category.name}</span>
                  </div>
                  <div className="space-x-2">
                    <Button variant="outline" size="iconSm" onClick={() => openEditDialog(category)} title={t.edit_category_button_title}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="destructiveOutline" size="iconSm" onClick={() => openDeleteDialog(category)} title={t.delete_category_button_title}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Add Category Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.add_new_category_dialog_title || "Add New Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <Label htmlFor="new-cat-name">{t.category_name_label || "Category Name"}</Label>
              <Input 
                id="new-cat-name" 
                value={newCategoryName} 
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={t.category_name_placeholder_add || "e.g., Tutorials, Music"} 
              />
            </div>
            <div>
              <Label>{t.category_color_label || "Category Color"}</Label>
              <div className="grid grid-cols-6 gap-2 mt-1 p-2 border rounded-md">
                {defaultColors.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-full h-8 rounded ${color} transition-all duration-150 ${newCategoryColor === color ? 'ring-2 ring-offset-2 ring-blue-500' : 'hover:opacity-80'}`}
                    onClick={() => setNewCategoryColor(color)}
                    aria-label={`Select color ${color.split('-')[1] || color}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>{t.cancel || "Cancel"}</Button>
            <Button onClick={handleAddCategory}>{t.add_button || "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      {editingCategory && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.edit_category_dialog_title || "Edit Category"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div>
                <Label htmlFor="edit-cat-name">{t.category_name_label || "Category Name"}</Label>
                <Input 
                  id="edit-cat-name" 
                  value={editingCategory.name} 
                  onChange={(e) => setEditingCategory({...editingCategory, name: e.target.value})}
                />
              </div>
              <div>
                <Label>{t.category_color_label || "Category Color"}</Label>
                <div className="grid grid-cols-6 gap-2 mt-1 p-2 border rounded-md">
                  {defaultColors.map(color => (
                    <button
                      key={color}
                      type="button"
                      className={`w-full h-8 rounded ${color} transition-all duration-150 ${editingCategory.color === color ? 'ring-2 ring-offset-2 ring-blue-500' : 'hover:opacity-80'}`}
                      onClick={() => setEditingCategory({...editingCategory, color: color})}
                      aria-label={`Select color ${color.split('-')[1] || color}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingCategory(null); }}>{t.cancel || "Cancel"}</Button>
              <Button onClick={handleEditCategory}>{t.save_changes_button || "Save Changes"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Category Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.delete_category_confirm_title || "Delete Category?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.delete_category_confirm_desc_1 || "Are you sure you want to delete the category"} <strong>"{categoryToDelete?.name}"</strong>?
              <br/>
              {t.delete_category_confirm_desc_2 || "Videos using this category will have their category removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setIsDeleteDialogOpen(false); setCategoryToDelete(null); }}>{t.cancel || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-red-600 hover:bg-red-700">
              {t.delete_button || "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
